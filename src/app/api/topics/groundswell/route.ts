import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GroundswellTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  votes_24h: number
  votes_prior_7d: number
  /** avg daily votes over prior 7 days */
  baseline_daily: number
  /** votes_24h / baseline_daily — how many x above the prior baseline */
  revival_rate: number
  scope: string | null
  created_at: string
}

export interface GroundswellResponse {
  awakenings: GroundswellTopic[]
  window_start: string
  generated_at: string
}

// ─── Config ────────────────────────────────────────────────────────────────────

/** Min votes in last 24 h for a topic to qualify as awakening. */
const MIN_RECENT_VOTES = 8
/** Min revival rate (x above baseline) to surface. */
const MIN_REVIVAL_RATE = 2.5
/** Max topics returned. */
const MAX_RESULTS = 20

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const window24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  // "prior 7 days" = 2–8 days ago (excludes the last 24 h to avoid double-counting)
  const window8d = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Votes in last 24 h ─────────────────────────────────────────────────
  const { data: recentVotes, error: recentErr } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', window24h)
    .limit(40000)

  if (recentErr) {
    return NextResponse.json({ error: 'votes_recent' }, { status: 500 })
  }

  // ── 2. Votes 2–8 days ago ─────────────────────────────────────────────────
  const { data: priorVotes, error: priorErr } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', window8d)
    .lt('created_at', window24h)
    .limit(100000)

  if (priorErr) {
    return NextResponse.json({ error: 'votes_prior' }, { status: 500 })
  }

  // ── 3. Count votes per topic ──────────────────────────────────────────────
  const recent24hMap: Record<string, number> = {}
  for (const v of recentVotes ?? []) {
    recent24hMap[v.topic_id] = (recent24hMap[v.topic_id] ?? 0) + 1
  }

  const prior7dMap: Record<string, number> = {}
  for (const v of priorVotes ?? []) {
    prior7dMap[v.topic_id] = (prior7dMap[v.topic_id] ?? 0) + 1
  }

  // ── 4. Find topics with significant revival rate ──────────────────────────
  const candidateIds = Object.keys(recent24hMap).filter((id) => {
    const votes24h = recent24hMap[id] ?? 0
    if (votes24h < MIN_RECENT_VOTES) return false
    const prior7d = prior7dMap[id] ?? 0
    const baselineDaily = prior7d / 7
    // If baseline is very low (near zero), rate = infinity — cap at 100x
    const rate = baselineDaily < 0.5 ? votes24h * 2 : votes24h / baselineDaily
    return rate >= MIN_REVIVAL_RATE
  })

  if (candidateIds.length === 0) {
    return NextResponse.json({
      awakenings: [],
      window_start: window24h,
      generated_at: new Date().toISOString(),
    } satisfies GroundswellResponse)
  }

  // ── 5. Fetch topic details ────────────────────────────────────────────────
  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, total_votes, scope, created_at'
    )
    .in('id', candidateIds.slice(0, 200))
    .in('status', ['proposed', 'active', 'voting'])

  if (topicsErr) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  // ── 6. Build result ───────────────────────────────────────────────────────
  const awakenings: GroundswellTopic[] = (topics ?? [])
    .map((t) => {
      const votes24h = recent24hMap[t.id] ?? 0
      const prior7d = prior7dMap[t.id] ?? 0
      const baselineDaily = prior7d / 7
      const revivalRate =
        baselineDaily < 0.5 ? Math.min(votes24h * 2, 100) : votes24h / baselineDaily

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        votes_24h: votes24h,
        votes_prior_7d: prior7d,
        baseline_daily: Math.round(baselineDaily * 10) / 10,
        revival_rate: Math.round(revivalRate * 10) / 10,
        scope: t.scope,
        created_at: t.created_at,
      }
    })
    .filter((t) => t.revival_rate >= MIN_REVIVAL_RATE)
    .sort((a, b) => b.revival_rate - a.revival_rate)
    .slice(0, MAX_RESULTS)

  return NextResponse.json({
    awakenings,
    window_start: window24h,
    generated_at: new Date().toISOString(),
  } satisfies GroundswellResponse)
}
