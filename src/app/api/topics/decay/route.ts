import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10-min cache — decay signals are slow-moving

// ─── Types ────────────────────────────────────────────────────────────────────

export type DecayClass =
  | 'dormant'  // ≥ 80% drop — debate has gone almost completely cold
  | 'fading'   // ≥ 60% drop — activity significantly declining
  | 'cooling'  // ≥ 40% drop — noticeable momentum loss

export interface DecayTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  total_votes: number
  blue_pct: number
  /** Votes cast 7–14 days ago (prior window) */
  prior_count: number
  /** Votes cast 0–7 days ago (recent window) */
  recent_count: number
  /** decay_rate = (prior - recent) / prior × 100  (0–100) */
  decay_rate: number
  decay_class: DecayClass
  /** Estimated "half-life" in days based on current decay trajectory */
  half_life_estimate: number | null
}

export interface CategoryDecay {
  category: string
  topic_count: number
  avg_decay_rate: number
  dormant_count: number
  fading_count: number
  cooling_count: number
}

export interface DecayStats {
  total_decaying: number
  dormant_count: number
  fading_count: number
  cooling_count: number
  max_decay_rate: number
  avg_decay_rate: number
  most_forgotten_category: string | null
  /** topics that completely went silent (recent_count === 0) */
  total_silent: number
}

export interface DecayResponse {
  dormant: DecayTopic[]
  fading: DecayTopic[]
  cooling: DecayTopic[]
  category_breakdown: CategoryDecay[]
  stats: DecayStats
  window_days: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WINDOW_DAYS      = 7
const MIN_PRIOR_VOTES  = 8   // topic must have had meaningful prior activity
const MIN_TOTAL_VOTES  = 20  // topic must have a non-trivial vote base overall
const COOLING_THRESHOLD  = 40
const FADING_THRESHOLD   = 60
const DORMANT_THRESHOLD  = 80
const MAX_PER_CLASS      = 30

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const recentStart = new Date(now - WINDOW_DAYS * 86_400_000).toISOString()
  const priorStart  = new Date(now - 2 * WINDOW_DAYS * 86_400_000).toISOString()
  const priorEnd    = recentStart

  // ── 1. Recent votes (last 7 days) ──────────────────────────────────────────
  const { data: recentVotes, error: recentErr } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', recentStart)
    .limit(60_000)

  if (recentErr) return NextResponse.json({ error: 'recent_votes_fetch' }, { status: 500 })

  // ── 2. Prior votes (7–14 days ago) ─────────────────────────────────────────
  const { data: priorVotes, error: priorErr } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', priorStart)
    .lt('created_at', priorEnd)
    .limit(60_000)

  if (priorErr) return NextResponse.json({ error: 'prior_votes_fetch' }, { status: 500 })

  // ── 3. Aggregate vote counts per topic ─────────────────────────────────────
  const recentMap = new Map<string, number>()
  for (const v of recentVotes ?? []) {
    recentMap.set(v.topic_id, (recentMap.get(v.topic_id) ?? 0) + 1)
  }

  const priorMap = new Map<string, number>()
  for (const v of priorVotes ?? []) {
    priorMap.set(v.topic_id, (priorMap.get(v.topic_id) ?? 0) + 1)
  }

  // ── 4. Find topics with significant prior activity that are now quiet ───────
  const candidates: string[] = []
  for (const [tid, priorCount] of priorMap.entries()) {
    if (priorCount < MIN_PRIOR_VOTES) continue
    const recentCount = recentMap.get(tid) ?? 0
    const decayRate = ((priorCount - recentCount) / priorCount) * 100
    if (decayRate >= COOLING_THRESHOLD) {
      candidates.push(tid)
    }
  }

  if (candidates.length === 0) return NextResponse.json(buildEmpty())

  // ── 5. Fetch topic metadata (only open topics) ─────────────────────────────
  const { data: topicsData, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('id', candidates.slice(0, 400))
    .in('status', ['proposed', 'active', 'voting'])
    .gte('total_votes', MIN_TOTAL_VOTES)
    .not('blue_pct', 'is', null)

  if (topicsErr) return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })

  // ── 6. Compute decay metrics ───────────────────────────────────────────────
  const results: DecayTopic[] = []

  for (const t of topicsData ?? []) {
    const priorCount  = priorMap.get(t.id) ?? 0
    const recentCount = recentMap.get(t.id) ?? 0

    if (priorCount < MIN_PRIOR_VOTES) continue

    const decayRate = ((priorCount - recentCount) / priorCount) * 100
    if (decayRate < COOLING_THRESHOLD) continue

    const decayClass: DecayClass =
      decayRate >= DORMANT_THRESHOLD ? 'dormant'
      : decayRate >= FADING_THRESHOLD ? 'fading'
      : 'cooling'

    // Estimate half-life: how many more days until votes halve again at this rate
    // Using exponential decay model: T½ = ln(2) / λ where λ = decay_rate per week
    const weeklyDecayFraction = (priorCount - recentCount) / priorCount
    const halfLifeDays = weeklyDecayFraction > 0 && weeklyDecayFraction < 1
      ? Math.round((Math.log(2) / (-Math.log(1 - weeklyDecayFraction))) * 7)
      : null

    results.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      scope: (t as { scope?: string | null }).scope ?? null,
      total_votes: t.total_votes ?? 0,
      blue_pct: Math.round((t.blue_pct ?? 50) * 10) / 10,
      prior_count: priorCount,
      recent_count: recentCount,
      decay_rate: Math.round(decayRate * 10) / 10,
      decay_class: decayClass,
      half_life_estimate: halfLifeDays,
    })
  }

  // Sort by decay rate descending (most forgotten first)
  results.sort((a, b) => b.decay_rate - a.decay_rate)

  // ── 7. Partition into tiers ────────────────────────────────────────────────
  const dormant = results.filter((t) => t.decay_class === 'dormant').slice(0, MAX_PER_CLASS)
  const fading  = results.filter((t) => t.decay_class === 'fading').slice(0, MAX_PER_CLASS)
  const cooling = results.filter((t) => t.decay_class === 'cooling').slice(0, MAX_PER_CLASS)

  // ── 8. Category breakdown ──────────────────────────────────────────────────
  const catMap = new Map<string, DecayTopic[]>()
  for (const t of results) {
    const cat = t.category ?? 'Other'
    const arr = catMap.get(cat) ?? []
    arr.push(t)
    catMap.set(cat, arr)
  }

  const category_breakdown: CategoryDecay[] = [...catMap.entries()]
    .map(([category, items]) => ({
      category,
      topic_count: items.length,
      avg_decay_rate: Math.round(
        (items.reduce((s, t) => s + t.decay_rate, 0) / items.length) * 10
      ) / 10,
      dormant_count: items.filter((t) => t.decay_class === 'dormant').length,
      fading_count:  items.filter((t) => t.decay_class === 'fading').length,
      cooling_count: items.filter((t) => t.decay_class === 'cooling').length,
    }))
    .sort((a, b) => b.avg_decay_rate - a.avg_decay_rate)

  // ── 9. Platform stats ──────────────────────────────────────────────────────
  const total = results.length
  const avgDecay = total > 0
    ? Math.round((results.reduce((s, t) => s + t.decay_rate, 0) / total) * 10) / 10
    : 0
  const maxDecay = total > 0
    ? Math.round(Math.max(...results.map((t) => t.decay_rate)) * 10) / 10
    : 0
  const totalSilent = results.filter((t) => t.recent_count === 0).length

  const stats: DecayStats = {
    total_decaying: total,
    dormant_count: dormant.length,
    fading_count: fading.length,
    cooling_count: cooling.length,
    max_decay_rate: maxDecay,
    avg_decay_rate: avgDecay,
    most_forgotten_category: category_breakdown[0]?.category ?? null,
    total_silent: totalSilent,
  }

  return NextResponse.json({
    dormant,
    fading,
    cooling,
    category_breakdown,
    stats,
    window_days: WINDOW_DAYS,
    generated_at: new Date().toISOString(),
  } satisfies DecayResponse)
}

// ─── Empty helper ─────────────────────────────────────────────────────────────

function buildEmpty(): DecayResponse {
  return {
    dormant: [],
    fading: [],
    cooling: [],
    category_breakdown: [],
    stats: {
      total_decaying: 0,
      dormant_count: 0,
      fading_count: 0,
      cooling_count: 0,
      max_decay_rate: 0,
      avg_decay_rate: 0,
      most_forgotten_category: null,
      total_silent: 0,
    },
    window_days: 7,
    generated_at: new Date().toISOString(),
  }
}
