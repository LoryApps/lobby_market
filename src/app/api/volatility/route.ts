import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailySnapshot {
  day: string          // YYYY-MM-DD
  blue_count: number
  total_count: number
  for_pct: number      // 0–100
}

export interface VolatileTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  volatility_score: number   // stddev of daily for_pct (0–50 range in practice)
  volatility_label: 'extreme' | 'high' | 'moderate' | 'low'
  recent_votes: number       // votes in last 7 days
  day_count: number          // number of active days with data
  snapshots: DailySnapshot[] // day-by-day breakdown (oldest → newest)
  swing_range: number        // max daily for_pct minus min daily for_pct
  current_trend: 'rising' | 'falling' | 'stable'  // last 2 days vs prior 2 days
}

export interface CategoryVolatility {
  category: string
  avg_volatility: number
  topic_count: number
  most_volatile_id: string
  most_volatile_statement: string
}

export interface VolatilityResponse {
  generated_at: string
  topics: VolatileTopic[]
  category_volatility: CategoryVolatility[]
  platform_avg_volatility: number
  window_days: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function volatilityLabel(score: number): VolatileTopic['volatility_label'] {
  if (score >= 20) return 'extreme'
  if (score >= 12) return 'high'
  if (score >= 6)  return 'moderate'
  return 'low'
}

function trendFromSnapshots(snaps: DailySnapshot[]): VolatileTopic['current_trend'] {
  if (snaps.length < 3) return 'stable'
  const recent = snaps.slice(-2).map((s) => s.for_pct)
  const prior  = snaps.slice(-4, -2).map((s) => s.for_pct)
  if (prior.length === 0) return 'stable'
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const priorAvg  = prior.reduce((a, b) => a + b, 0) / prior.length
  const diff = recentAvg - priorAvg
  if (diff > 3)  return 'rising'
  if (diff < -3) return 'falling'
  return 'stable'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const supabase = await createClient()

  const WINDOW_DAYS = 7
  const MIN_RECENT_VOTES = 5
  const MIN_DAYS = 2

  // ── 1. Fetch all active/voting/proposed topics ────────────────────────────
  let topicQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_RECENT_VOTES)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (category) {
    topicQuery = topicQuery.eq('category', category)
  }

  const { data: topicRows, error: topicErr } = await topicQuery
  if (topicErr || !topicRows?.length) {
    return NextResponse.json<VolatilityResponse>({
      generated_at: new Date().toISOString(),
      topics: [],
      category_volatility: [],
      platform_avg_volatility: 0,
      window_days: WINDOW_DAYS,
    })
  }

  const topicIds = topicRows.map((t) => t.id)
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // ── 2. Fetch votes within the window for these topics ────────────────────
  const { data: voteRows, error: voteErr } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .in('topic_id', topicIds)
    .gte('created_at', since)

  if (voteErr || !voteRows) {
    return NextResponse.json<VolatilityResponse>({
      generated_at: new Date().toISOString(),
      topics: [],
      category_volatility: [],
      platform_avg_volatility: 0,
      window_days: WINDOW_DAYS,
    })
  }

  // ── 3. Build day-by-day snapshots per topic ───────────────────────────────
  // Group votes by topic then by day
  type DayMap = Map<string, { blue: number; total: number }>
  const byTopic = new Map<string, DayMap>()

  for (const row of voteRows) {
    const day = row.created_at.slice(0, 10) // YYYY-MM-DD
    let dayMap = byTopic.get(row.topic_id)
    if (!dayMap) { dayMap = new Map(); byTopic.set(row.topic_id, dayMap) }
    const existing = dayMap.get(day) ?? { blue: 0, total: 0 }
    existing.total += 1
    if (row.side === 'blue') existing.blue += 1
    dayMap.set(day, existing)
  }

  // ── 4. Compute volatility per topic ──────────────────────────────────────
  const volatile: VolatileTopic[] = []

  for (const topic of topicRows) {
    const dayMap = byTopic.get(topic.id)
    if (!dayMap || dayMap.size < MIN_DAYS) continue

    const sortedDays = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    const snapshots: DailySnapshot[] = sortedDays.map(([day, { blue, total }]) => ({
      day,
      blue_count: blue,
      total_count: total,
      for_pct: total > 0 ? Math.round((blue / total) * 100) : 50,
    }))

    const forPcts = snapshots.map((s) => s.for_pct)
    const recentVotes = snapshots.reduce((sum, s) => sum + s.total_count, 0)

    if (recentVotes < MIN_RECENT_VOTES) continue

    const score = stddev(forPcts)
    const minPct = Math.min(...forPcts)
    const maxPct = Math.max(...forPcts)

    volatile.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      volatility_score: Math.round(score * 10) / 10,
      volatility_label: volatilityLabel(score),
      recent_votes: recentVotes,
      day_count: snapshots.length,
      snapshots,
      swing_range: maxPct - minPct,
      current_trend: trendFromSnapshots(snapshots),
    })
  }

  // Sort by volatility descending, take top 40
  volatile.sort((a, b) => b.volatility_score - a.volatility_score)
  const topics = volatile.slice(0, 40)

  // ── 5. Category breakdown ─────────────────────────────────────────────────
  const catMap = new Map<string, VolatileTopic[]>()
  for (const t of volatile) {
    const cat = t.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, [])
    catMap.get(cat)!.push(t)
  }

  const category_volatility: CategoryVolatility[] = []
  for (const [cat, items] of catMap.entries()) {
    if (!CATEGORIES.includes(cat)) continue
    const sorted = [...items].sort((a, b) => b.volatility_score - a.volatility_score)
    category_volatility.push({
      category: cat,
      avg_volatility: Math.round((items.reduce((s, i) => s + i.volatility_score, 0) / items.length) * 10) / 10,
      topic_count: items.length,
      most_volatile_id: sorted[0].id,
      most_volatile_statement: sorted[0].statement,
    })
  }
  category_volatility.sort((a, b) => b.avg_volatility - a.avg_volatility)

  const platform_avg_volatility = volatile.length > 0
    ? Math.round((volatile.reduce((s, t) => s + t.volatility_score, 0) / volatile.length) * 10) / 10
    : 0

  return NextResponse.json<VolatilityResponse>({
    generated_at: new Date().toISOString(),
    topics,
    category_volatility,
    platform_avg_volatility,
    window_days: WINDOW_DAYS,
  })
}
