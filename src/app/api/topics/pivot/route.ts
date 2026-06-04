import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-min cache

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Classification of how dramatic the opinion reversal is, measured as the
 * absolute gap between a topic's lifetime blue_pct and its recent-window blue_pct.
 *
 *   landmark  — |swing| ≥ 35pp — the community has fundamentally reconsidered
 *   major     — |swing| ≥ 20pp — clear, deliberate directional change
 *   notable   — |swing| ≥ 10pp — meaningful drift worth watching
 */
export type PivotClass = 'landmark' | 'major' | 'notable'

/**
 * Which direction the recent community is moving relative to the historical average.
 *   shifting_for     — recent voters lean more FOR than the all-time consensus
 *   shifting_against — recent voters lean more AGAINST than the all-time consensus
 */
export type PivotDirection = 'shifting_for' | 'shifting_against'

export interface PivotTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  created_at: string
  days_old: number
  total_votes: number
  /** All-time blue_pct stored on the topic row */
  lifetime_blue_pct: number
  /** Blue % computed from votes cast in the last WINDOW_DAYS */
  recent_blue_pct: number
  recent_vote_count: number
  /** recent_blue_pct − lifetime_blue_pct — positive = shifting FOR */
  swing: number
  pivot_direction: PivotDirection
  pivot_class: PivotClass
}

export interface CategoryPivot {
  category: string
  topic_count: number
  avg_swing: number
  landmark_count: number
  major_count: number
}

export interface PivotStats {
  total_pivoting: number
  landmark_count: number
  major_count: number
  notable_count: number
  shifting_for_count: number
  shifting_against_count: number
  max_swing: number
  avg_swing: number
  most_active_category: string | null
  platform_mood: 'reversing' | 'drifting' | 'stable'
}

export interface PivotResponse {
  topics: PivotTopic[]
  shifting_for: PivotTopic[]
  shifting_against: PivotTopic[]
  category_breakdown: CategoryPivot[]
  stats: PivotStats
  window_days: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WINDOW_DAYS       = 7
const MIN_RECENT_VOTES  = 5    // minimum votes in the recent window per topic
const MIN_TOTAL_VOTES   = 30   // topic must have a meaningful vote base
const MIN_TOPIC_AGE_DAYS = 14  // topic must be at least this old (established baseline)
const NOTABLE_THRESHOLD  = 10
const MAJOR_THRESHOLD    = 20
const LANDMARK_THRESHOLD = 35
const MAX_RESULTS        = 60

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const categoryFilter = searchParams.get('category') ?? null

  const supabase = await createClient()

  const now              = Date.now()
  const windowStart      = new Date(now - WINDOW_DAYS * 86_400_000).toISOString()
  const minTopicAgeDate  = new Date(now - MIN_TOPIC_AGE_DAYS * 86_400_000).toISOString()

  // ── 1. Fetch recent votes ────────────────────────────────────────────────────
  const { data: recentVotes, error: votesErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', windowStart)
    .limit(60_000)

  if (votesErr) return NextResponse.json({ error: 'votes_fetch' }, { status: 500 })

  // ── 2. Aggregate per topic ───────────────────────────────────────────────────
  const recentForMap = new Map<string, number>()
  const recentTotMap = new Map<string, number>()

  for (const v of recentVotes ?? []) {
    recentTotMap.set(v.topic_id, (recentTotMap.get(v.topic_id) ?? 0) + 1)
    if (v.side === 'blue') {
      recentForMap.set(v.topic_id, (recentForMap.get(v.topic_id) ?? 0) + 1)
    }
  }

  // ── 3. Find candidates: topics with enough recent votes ─────────────────────
  const candidates = [...recentTotMap.entries()]
    .filter(([, count]) => count >= MIN_RECENT_VOTES)
    .map(([id]) => id)

  if (candidates.length === 0) return NextResponse.json(buildEmpty())

  // ── 4. Fetch topic metadata ─────────────────────────────────────────────────
  // Only topics that are old enough to have an "established" consensus baseline
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, created_at')
    .in('id', candidates.slice(0, 400))
    .gte('total_votes', MIN_TOTAL_VOTES)
    .lte('created_at', minTopicAgeDate) // at least MIN_TOPIC_AGE_DAYS old
    .not('blue_pct', 'is', null)

  if (categoryFilter) {
    query = query.eq('category', categoryFilter)
  }

  const { data: topicsData, error: topicsErr } = await query

  if (topicsErr) return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })

  // ── 5. Compute pivot metrics ─────────────────────────────────────────────────
  const results: PivotTopic[] = []

  for (const t of topicsData ?? []) {
    const recentCount = recentTotMap.get(t.id) ?? 0
    if (recentCount < MIN_RECENT_VOTES) continue

    const recentFor  = recentForMap.get(t.id) ?? 0
    const recentPct  = (recentFor / recentCount) * 100
    const lifetimePct = t.blue_pct ?? 50
    const swing       = recentPct - lifetimePct
    const absSwing    = Math.abs(swing)

    if (absSwing < NOTABLE_THRESHOLD) continue

    const pivot_class: PivotClass =
      absSwing >= LANDMARK_THRESHOLD ? 'landmark'
      : absSwing >= MAJOR_THRESHOLD   ? 'major'
      : 'notable'

    const pivot_direction: PivotDirection =
      swing > 0 ? 'shifting_for' : 'shifting_against'

    const createdAt  = new Date(t.created_at)
    const days_old   = Math.floor((now - createdAt.getTime()) / 86_400_000)

    results.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      scope: (t as { scope?: string | null }).scope ?? null,
      created_at: t.created_at,
      days_old,
      total_votes: t.total_votes ?? 0,
      lifetime_blue_pct: Math.round(lifetimePct * 10) / 10,
      recent_blue_pct: Math.round(recentPct * 10) / 10,
      recent_vote_count: recentCount,
      swing: Math.round(swing * 10) / 10,
      pivot_direction,
      pivot_class,
    })
  }

  // ── 6. Sort by absolute swing descending ────────────────────────────────────
  results.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))

  const topResults = results.slice(0, MAX_RESULTS)

  // ── 7. Partition ─────────────────────────────────────────────────────────────
  const shifting_for      = topResults.filter((t) => t.pivot_direction === 'shifting_for')
  const shifting_against  = topResults.filter((t) => t.pivot_direction === 'shifting_against')

  // ── 8. Category breakdown ────────────────────────────────────────────────────
  const catMap = new Map<string, PivotTopic[]>()
  for (const t of topResults) {
    const cat = t.category ?? 'Other'
    const arr = catMap.get(cat) ?? []
    arr.push(t)
    catMap.set(cat, arr)
  }

  const category_breakdown: CategoryPivot[] = [...catMap.entries()]
    .map(([category, items]) => ({
      category,
      topic_count: items.length,
      avg_swing: Math.round(
        (items.reduce((s, t) => s + Math.abs(t.swing), 0) / items.length) * 10
      ) / 10,
      landmark_count: items.filter((t) => t.pivot_class === 'landmark').length,
      major_count:    items.filter((t) => t.pivot_class === 'major').length,
    }))
    .sort((a, b) => b.avg_swing - a.avg_swing)

  // ── 9. Platform stats ─────────────────────────────────────────────────────────
  const total     = topResults.length
  const landmark  = topResults.filter((t) => t.pivot_class === 'landmark').length
  const major     = topResults.filter((t) => t.pivot_class === 'major').length
  const notable   = topResults.filter((t) => t.pivot_class === 'notable').length
  const avgSwing  = total > 0
    ? Math.round((topResults.reduce((s, t) => s + Math.abs(t.swing), 0) / total) * 10) / 10
    : 0
  const maxSwing  = total > 0
    ? Math.round(Math.max(...topResults.map((t) => Math.abs(t.swing))) * 10) / 10
    : 0

  const platform_mood: PivotStats['platform_mood'] =
    landmark >= 3 ? 'reversing'
    : major >= 5 || total >= 10 ? 'drifting'
    : 'stable'

  const stats: PivotStats = {
    total_pivoting: total,
    landmark_count: landmark,
    major_count: major,
    notable_count: notable,
    shifting_for_count: shifting_for.length,
    shifting_against_count: shifting_against.length,
    max_swing: maxSwing,
    avg_swing: avgSwing,
    most_active_category: category_breakdown[0]?.category ?? null,
    platform_mood,
  }

  return NextResponse.json({
    topics: topResults,
    shifting_for,
    shifting_against,
    category_breakdown,
    stats,
    window_days: WINDOW_DAYS,
    generated_at: new Date().toISOString(),
  } satisfies PivotResponse)
}

// ─── Empty helper ─────────────────────────────────────────────────────────────

function buildEmpty(): PivotResponse {
  return {
    topics: [],
    shifting_for: [],
    shifting_against: [],
    category_breakdown: [],
    stats: {
      total_pivoting: 0,
      landmark_count: 0,
      major_count: 0,
      notable_count: 0,
      shifting_for_count: 0,
      shifting_against_count: 0,
      max_swing: 0,
      avg_swing: 0,
      most_active_category: null,
      platform_mood: 'stable',
    },
    window_days: WINDOW_DAYS,
    generated_at: new Date().toISOString(),
  }
}
