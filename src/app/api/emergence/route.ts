import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmergingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  scope: string | null

  // Emergence metrics
  days_old: number
  votes_per_day: number          // total_votes / days_old
  arg_count: number              // arguments posted so far
  args_per_day: number           // arguments per day
  view_count: number             // page views
  views_per_day: number          // views per day
  emergence_score: number        // composite 0–100
  emergence_tier: 'breakthrough' | 'surging' | 'rising' | 'building'
  // Momentum window — recent votes (last 24h) vs older votes
  votes_last_24h: number
  acceleration: number           // votes_last_24h / (votes_per_day prior)
}

export interface EmergenceCategory {
  category: string
  emerging_count: number
  avg_emergence_score: number
  top_topic_id: string
  top_topic_statement: string
}

export interface EmergenceResponse {
  topics: EmergingTopic[]
  categories: EmergenceCategory[]
  total: number
  window_days: number
  generated_at: string
  category_filter: string | null
  sort: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_VOTES = 15              // at least 15 votes to show real traction
const MAX_AGE_DAYS = 45          // only topics created in last 45 days
const MAX_RESULTS = 30
const RECENT_WINDOW_HOURS = 24

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emergenceTier(score: number): EmergingTopic['emergence_tier'] {
  if (score >= 75) return 'breakthrough'
  if (score >= 50) return 'surging'
  if (score >= 25) return 'rising'
  return 'building'
}

// ─── GET /api/emergence ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category')?.trim() ?? ''
  const rawSort = searchParams.get('sort') ?? 'score'
  const rawLimit = parseInt(searchParams.get('limit') ?? '24', 10)

  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null
  const sort = ['score', 'velocity', 'acceleration', 'recency'].includes(rawSort) ? rawSort : 'score'
  const limit = Math.min(Math.max(rawLimit, 6), MAX_RESULTS)

  const supabase = await createClient()

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const window24hStart = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  // ── 1. Fetch recently-created topics ─────────────────────────────────────
  let topicQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, scope, view_count')
    .gte('created_at', cutoff)
    .gte('total_votes', MIN_VOTES)
    .in('status', ['proposed', 'active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(300)

  if (category) {
    topicQuery = topicQuery.eq('category', category)
  }

  const { data: topicRows, error: topicErr } = await topicQuery
  if (topicErr || !topicRows?.length) {
    return NextResponse.json<EmergenceResponse>({
      topics: [],
      categories: [],
      total: 0,
      window_days: MAX_AGE_DAYS,
      generated_at: new Date().toISOString(),
      category_filter: category,
      sort,
    })
  }

  const topicIds = topicRows.map((t) => t.id)

  // ── 2. Argument counts per topic ──────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .in('topic_id', topicIds)

  const argCountMap: Record<string, number> = {}
  for (const r of argRows ?? []) {
    argCountMap[r.topic_id] = (argCountMap[r.topic_id] ?? 0) + 1
  }

  // ── 3. Recent votes (last 24 h) per topic ────────────────────────────────
  const { data: recentVoteRows } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', window24hStart)

  const recent24hMap: Record<string, number> = {}
  for (const r of recentVoteRows ?? []) {
    recent24hMap[r.topic_id] = (recent24hMap[r.topic_id] ?? 0) + 1
  }

  // ── 4. Compute emergence metrics ─────────────────────────────────────────
  const now = Date.now()
  const topics: EmergingTopic[] = []

  for (const t of topicRows) {
    const createdMs = new Date(t.created_at).getTime()
    const daysOld = Math.max((now - createdMs) / 86_400_000, 0.5) // min 0.5 days
    const votes = t.total_votes ?? 0
    const views = (t as { view_count?: number | null }).view_count ?? 0
    const argCount = argCountMap[t.id] ?? 0
    const last24h = recent24hMap[t.id] ?? 0

    const votesPerDay = votes / daysOld
    const argsPerDay = argCount / daysOld
    const viewsPerDay = views / daysOld

    // acceleration: how much faster is it growing NOW vs. its average?
    // (last 24h votes) vs (daily average over lifetime minus last 24h)
    const olderVotes = Math.max(votes - last24h, 0)
    const olderDays = Math.max(daysOld - 1, 0.1)
    const baselinePerDay = olderVotes / olderDays
    const acceleration = baselinePerDay > 0 ? last24h / baselinePerDay : (last24h > 0 ? 5 : 1)

    // Emergence score: weighted combination of normalised metrics
    // Velocity component (0–40): how fast votes are accumulating per day
    const velocityScore = Math.min(40, (votesPerDay / 10) * 40)
    // Argument engagement component (0–20): topic sparking discourse
    const argScore = Math.min(20, (argsPerDay / 1) * 10)
    // Acceleration component (0–25): gaining speed recently
    const accelScore = Math.min(25, (Math.log1p(acceleration) / Math.log1p(10)) * 25)
    // Recency bonus (0–15): newer topics score slightly higher for freshness
    const recencyScore = Math.max(0, 15 - (daysOld / MAX_AGE_DAYS) * 15)

    const emergence_score = Math.round(velocityScore + argScore + accelScore + recencyScore)

    topics.push({
      id: t.id,
      statement: t.statement ?? '',
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: votes,
      created_at: t.created_at,
      scope: (t as { scope?: string | null }).scope ?? null,
      days_old: Math.round(daysOld * 10) / 10,
      votes_per_day: Math.round(votesPerDay * 10) / 10,
      arg_count: argCount,
      args_per_day: Math.round(argsPerDay * 10) / 10,
      view_count: views,
      views_per_day: Math.round(viewsPerDay),
      emergence_score,
      emergence_tier: emergenceTier(emergence_score),
      votes_last_24h: last24h,
      acceleration: Math.round(acceleration * 10) / 10,
    })
  }

  // ── 5. Sort ───────────────────────────────────────────────────────────────
  switch (sort) {
    case 'velocity':
      topics.sort((a, b) => b.votes_per_day - a.votes_per_day)
      break
    case 'acceleration':
      topics.sort((a, b) => b.acceleration - a.acceleration)
      break
    case 'recency':
      topics.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      break
    default: // 'score'
      topics.sort((a, b) => b.emergence_score - a.emergence_score)
      break
  }

  const sliced = topics.slice(0, limit)

  // ── 6. Category breakdown ─────────────────────────────────────────────────
  const catMap = new Map<string, { count: number; scoreSum: number; top: EmergingTopic | null }>()
  for (const t of topics) {
    const cat = t.category ?? 'Other'
    const existing = catMap.get(cat) ?? { count: 0, scoreSum: 0, top: null }
    existing.count++
    existing.scoreSum += t.emergence_score
    if (!existing.top || t.emergence_score > existing.top.emergence_score) {
      existing.top = t
    }
    catMap.set(cat, existing)
  }

  const categories: EmergenceCategory[] = Array.from(catMap.entries())
    .map(([cat, acc]) => ({
      category: cat,
      emerging_count: acc.count,
      avg_emergence_score: Math.round(acc.scoreSum / acc.count),
      top_topic_id: acc.top?.id ?? '',
      top_topic_statement: acc.top?.statement ?? '',
    }))
    .sort((a, b) => b.avg_emergence_score - a.avg_emergence_score)

  return NextResponse.json<EmergenceResponse>({
    topics: sliced,
    categories,
    total: topics.length,
    window_days: MAX_AGE_DAYS,
    generated_at: new Date().toISOString(),
    category_filter: category,
    sort,
  })
}
