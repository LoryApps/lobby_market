import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TractionTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  created_at: string

  // Vote signal
  votes_24h: number
  votes_baseline_daily: number
  vote_velocity: number        // votes_24h / baseline (×)

  // Argument signal
  args_24h: number
  args_baseline_daily: number
  arg_velocity: number         // args_24h / baseline (×)

  // Subscription signal
  subs_24h: number
  subs_baseline_daily: number
  sub_velocity: number         // subs_24h / baseline (×)

  // Composite
  traction_score: number       // 0–100 normalised
  tier: 'breakthrough' | 'surging' | 'building' | 'emerging'
}

export interface TractionResponse {
  topics: TractionTopic[]
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_VOTES_24H     = 3   // at least 3 votes today to qualify
const MAX_RESULTS       = 25

// Tier thresholds (composite score 0–100)
function getTier(score: number): TractionTopic['tier'] {
  if (score >= 70) return 'breakthrough'
  if (score >= 45) return 'surging'
  if (score >= 20) return 'building'
  return 'emerging'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now      = Date.now()
  const ts24h    = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  // Prior window: 2–8 days ago (avoids double-counting the last 24 h)
  const ts8d     = new Date(now - 8  * 24 * 60 * 60 * 1000).toISOString()

  // ── Votes ──────────────────────────────────────────────────────────────────
  const [{ data: vRecent }, { data: vPrior }] = await Promise.all([
    supabase
      .from('votes')
      .select('topic_id')
      .gte('created_at', ts24h)
      .limit(50000),
    supabase
      .from('votes')
      .select('topic_id')
      .gte('created_at', ts8d)
      .lt('created_at', ts24h)
      .limit(200000),
  ])

  // ── Arguments ──────────────────────────────────────────────────────────────
  const [{ data: aRecent }, { data: aPrior }] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('topic_id')
      .gte('created_at', ts24h)
      .limit(10000),
    supabase
      .from('topic_arguments')
      .select('topic_id')
      .gte('created_at', ts8d)
      .lt('created_at', ts24h)
      .limit(50000),
  ])

  // ── Subscriptions ──────────────────────────────────────────────────────────
  const [{ data: sRecent }, { data: sPrior }] = await Promise.all([
    supabase
      .from('topic_subscriptions')
      .select('topic_id')
      .gte('created_at', ts24h)
      .limit(10000),
    supabase
      .from('topic_subscriptions')
      .select('topic_id')
      .gte('created_at', ts8d)
      .lt('created_at', ts24h)
      .limit(50000),
  ])

  // ── Index all counts ───────────────────────────────────────────────────────
  function countByTopic(rows: { topic_id: string }[] | null): Record<string, number> {
    const map: Record<string, number> = {}
    for (const r of rows ?? []) map[r.topic_id] = (map[r.topic_id] ?? 0) + 1
    return map
  }

  const v24   = countByTopic(vRecent)
  const vPrev = countByTopic(vPrior)
  const a24   = countByTopic(aRecent)
  const aPrev = countByTopic(aPrior)
  const s24   = countByTopic(sRecent)
  const sPrev = countByTopic(sPrior)

  // ── Candidate topic IDs ────────────────────────────────────────────────────
  const allIds = new Set([
    ...Object.keys(v24),
    ...Object.keys(a24),
    ...Object.keys(s24),
  ])

  // Filter: must have at least MIN_VOTES_24H recent votes
  const candidateIds = [...allIds].filter((id) => (v24[id] ?? 0) >= MIN_VOTES_24H)

  if (candidateIds.length === 0) {
    return NextResponse.json({
      topics: [],
      generated_at: new Date().toISOString(),
    } satisfies TractionResponse)
  }

  // ── Fetch topic details ────────────────────────────────────────────────────
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, created_at')
    .in('id', candidateIds.slice(0, 300))
    .in('status', ['proposed', 'active', 'voting'])

  if (error) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  // ── Compute scores ─────────────────────────────────────────────────────────
  function velocity(today: number, prior7d: number): number {
    const baseline = prior7d / 7
    if (baseline < 0.2) return Math.min(today * 3, 20) // bootstrapped — cap
    return today / baseline
  }

  // Normalise a velocity ratio into a 0–100 signal component.
  // A ratio of 1× = 20pts, 3× = 50pts, 7× = 80pts, 15× = 95pts (log scale).
  function normalise(ratio: number): number {
    if (ratio <= 0) return 0
    const score = (Math.log(ratio + 1) / Math.log(16)) * 100
    return Math.min(score, 100)
  }

  const WEIGHTS = { vote: 0.6, arg: 0.3, sub: 0.1 }

  const results: TractionTopic[] = (topics ?? [])
    .map((t) => {
      const votes24h       = v24[t.id]   ?? 0
      const voteBaseline   = (vPrev[t.id] ?? 0) / 7
      const voteVel        = velocity(votes24h, vPrev[t.id] ?? 0)

      const args24h        = a24[t.id]   ?? 0
      const argBaseline    = (aPrev[t.id] ?? 0) / 7
      const argVel         = velocity(args24h, aPrev[t.id] ?? 0)

      const subs24h        = s24[t.id]   ?? 0
      const subBaseline    = (sPrev[t.id] ?? 0) / 7
      const subVel         = velocity(subs24h, sPrev[t.id] ?? 0)

      const composite =
        WEIGHTS.vote * normalise(voteVel) +
        WEIGHTS.arg  * normalise(argVel)  +
        WEIGHTS.sub  * normalise(subVel)

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        scope: t.scope,
        created_at: t.created_at,

        votes_24h:            votes24h,
        votes_baseline_daily: Math.round(voteBaseline * 10) / 10,
        vote_velocity:        Math.round(voteVel      * 10) / 10,

        args_24h:             args24h,
        args_baseline_daily:  Math.round(argBaseline  * 10) / 10,
        arg_velocity:         Math.round(argVel       * 10) / 10,

        subs_24h:             subs24h,
        subs_baseline_daily:  Math.round(subBaseline  * 10) / 10,
        sub_velocity:         Math.round(subVel       * 10) / 10,

        traction_score: Math.round(composite),
        tier:           getTier(composite),
      } satisfies TractionTopic
    })
    .filter((t) => t.traction_score > 0)
    .sort((a, b) => b.traction_score - a.traction_score)
    .slice(0, MAX_RESULTS)

  return NextResponse.json({
    topics: results,
    generated_at: new Date().toISOString(),
  } satisfies TractionResponse)
}
