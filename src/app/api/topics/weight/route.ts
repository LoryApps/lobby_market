import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeightTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  created_at: string

  // Weight components
  scope_multiplier: number   // 4 Global / 3 National / 2 Regional / 1 Local / 1.5 null
  contested_factor: number   // 0–1; peaks at 1.0 when perfectly 50/50
  argument_count: number     // number of arguments posted
  votes_7d: number           // votes in last 7 days
  recency_factor: number     // votes_7d / max(total_votes * 0.1, 1), capped at 1

  // Composite
  weight_score: number       // 0–100 normalised
  tier: 'critical' | 'major' | 'notable' | 'local'
}

export interface WeightResponse {
  topics: WeightTopic[]
  generated_at: string
  category_weights: { category: string; avg_weight: number; count: number }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RESULTS = 30
const MIN_VOTES   = 5    // ignore very new topics

const SCOPE_MULT: Record<string, number> = {
  Global:   4,
  National: 3,
  Regional: 2,
  Local:    1,
}

function getTier(score: number): WeightTopic['tier'] {
  if (score >= 70) return 'critical'
  if (score >= 45) return 'major'
  if (score >= 20) return 'notable'
  return 'local'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now  = Date.now()
  const ts7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Fetch active/voting topics ────────────────────────────────────────────
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, created_at')
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_VOTES)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (error || !topics) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  if (topics.length === 0) {
    return NextResponse.json({
      topics: [],
      generated_at: new Date().toISOString(),
      category_weights: [],
    } satisfies WeightResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // ── Recent votes (7d) ─────────────────────────────────────────────────────
  const { data: vRecent } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', ts7d)
    .limit(100000)

  const votes7dMap = new Map<string, number>()
  for (const v of vRecent ?? []) {
    votes7dMap.set(v.topic_id, (votes7dMap.get(v.topic_id) ?? 0) + 1)
  }

  // ── Argument counts ───────────────────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .in('topic_id', topicIds)
    .limit(50000)

  const argCountMap = new Map<string, number>()
  for (const a of argRows ?? []) {
    argCountMap.set(a.topic_id, (argCountMap.get(a.topic_id) ?? 0) + 1)
  }

  // ── Compute raw weights ───────────────────────────────────────────────────
  const rawWeights = topics.map((t) => {
    const scopeMult    = SCOPE_MULT[t.scope ?? ''] ?? 1.5
    const contestedFactor = 1 - Math.abs((t.blue_pct ?? 50) - 50) / 50
    const argCount     = argCountMap.get(t.id) ?? 0
    const votes7d      = votes7dMap.get(t.id) ?? 0
    const recencyFactor = Math.min(votes7d / Math.max(t.total_votes * 0.05, 1), 1)
    const argDepth      = Math.log1p(argCount) / 5  // diminishing returns

    // Raw score: stakes × engagement × urgency × depth × recency boost
    const raw =
      scopeMult *
      Math.sqrt(t.total_votes) *
      (0.5 + contestedFactor * 0.5) *  // floor at 0.5 so low-contest topics still count
      (1 + argDepth) *
      (1 + recencyFactor * 0.5)

    return {
      topic: t,
      scopeMult,
      contestedFactor,
      argCount,
      votes7d,
      recencyFactor,
      raw,
    }
  })

  // ── Normalise to 0–100 ────────────────────────────────────────────────────
  const maxRaw = Math.max(...rawWeights.map((r) => r.raw), 1)

  const weighted: WeightTopic[] = rawWeights
    .map(({ topic: t, scopeMult, contestedFactor, argCount, votes7d, recencyFactor, raw }) => {
      const weight_score = Math.round((raw / maxRaw) * 100)
      return {
        id:               t.id,
        statement:        t.statement,
        category:         t.category,
        status:           t.status,
        blue_pct:         t.blue_pct ?? 50,
        total_votes:      t.total_votes,
        scope:            t.scope,
        created_at:       t.created_at,
        scope_multiplier: scopeMult,
        contested_factor: Math.round(contestedFactor * 100) / 100,
        argument_count:   argCount,
        votes_7d:         votes7d,
        recency_factor:   Math.round(recencyFactor * 100) / 100,
        weight_score,
        tier: getTier(weight_score),
      } satisfies WeightTopic
    })
    .sort((a, b) => b.weight_score - a.weight_score)
    .slice(0, MAX_RESULTS)

  // ── Category weight averages ──────────────────────────────────────────────
  const catMap = new Map<string, { total: number; count: number }>()
  for (const t of weighted) {
    const cat = t.category ?? 'Other'
    const prev = catMap.get(cat) ?? { total: 0, count: 0 }
    catMap.set(cat, { total: prev.total + t.weight_score, count: prev.count + 1 })
  }
  const category_weights = Array.from(catMap.entries())
    .map(([category, { total, count }]) => ({
      category,
      avg_weight: Math.round(total / count),
      count,
    }))
    .sort((a, b) => b.avg_weight - a.avg_weight)

  return NextResponse.json({
    topics: weighted,
    generated_at: new Date().toISOString(),
    category_weights,
  } satisfies WeightResponse)
}
