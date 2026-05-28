import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DroughtTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  created_at: string
  /** ISO string of the last vote cast, or null if never voted */
  last_vote_at: string | null
  /** ISO string of the last argument posted, or null if never */
  last_argument_at: string | null
  /** Days since the most recent activity (vote OR argument) */
  days_silent: number
  /** Peak daily vote count during the topic's lifetime */
  peak_daily_votes: number
  /** How far the topic has drifted from its peak (0–100 pct drop) */
  drought_severity: number
}

export interface DroughtStats {
  total_silent: number
  avg_days_silent: number
  longest_drought_days: number
  longest_drought_id: string | null
  longest_drought_statement: string | null
  categories: { category: string; count: number }[]
}

export interface DroughtResponse {
  topics: DroughtTopic[]
  stats: DroughtStats
  window_days: number
  generated_at: string
  has_more: boolean
}

// ─── Config ────────────────────────────────────────────────────────────────────

/** Topics silent for at least this many days qualify */
const SILENCE_THRESHOLD_DAYS = 7
const MAX_RESULTS = 30

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category') ?? null
  const sort = searchParams.get('sort') ?? 'silence' // 'silence' | 'votes' | 'severity'
  const statusFilter = searchParams.get('status') ?? null // null = all eligible

  const now = Date.now()
  const silenceCutoff = new Date(now - SILENCE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const window30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Fetch active/proposed/voting topics ────────────────────────────────
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, created_at, updated_at')
    .in('status', statusFilter
      ? [statusFilter]
      : ['active', 'proposed', 'voting']
    )
    .gte('total_votes', 5) // skip trivial topics with barely any engagement
    .order('total_votes', { ascending: false })
    .limit(200)

  if (category) topicsQuery = topicsQuery.eq('category', category)

  const { data: topics, error: topicsErr } = await topicsQuery
  if (topicsErr || !topics?.length) {
    return NextResponse.json({
      topics: [],
      stats: { total_silent: 0, avg_days_silent: 0, longest_drought_days: 0, longest_drought_id: null, longest_drought_statement: null, categories: [] },
      window_days: SILENCE_THRESHOLD_DAYS,
      generated_at: new Date().toISOString(),
      has_more: false,
    })
  }

  const topicIds = topics.map((t) => t.id)

  // ── 2. Last vote per topic (within 30-day window for efficiency) ──────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .in('topic_id', topicIds)
    .gte('created_at', window30d)
    .order('created_at', { ascending: false })
    .limit(50000)

  // Build a map of topicId → most recent vote timestamp
  const lastVoteMap: Record<string, string> = {}
  for (const v of recentVotes ?? []) {
    if (!lastVoteMap[v.topic_id]) {
      lastVoteMap[v.topic_id] = v.created_at
    }
  }

  // ── 3. Last argument per topic ────────────────────────────────────────────
  const { data: recentArgs } = await supabase
    .from('arguments')
    .select('topic_id, created_at')
    .in('topic_id', topicIds)
    .gte('created_at', window30d)
    .order('created_at', { ascending: false })
    .limit(20000)

  const lastArgMap: Record<string, string> = {}
  for (const a of recentArgs ?? []) {
    if (!lastArgMap[a.topic_id]) {
      lastArgMap[a.topic_id] = a.created_at
    }
  }

  // ── 4. Peak daily votes per topic (rough proxy: max votes in any 7-day window)
  // For simplicity, compute total votes / days alive as a proxy for "average daily"
  // and flag ones whose last-7d rate < 10% of lifetime average as in drought.
  // (A proper peak calculation would require bucketing by day which is expensive.)

  const { data: last7dVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(50000)

  const last7dMap: Record<string, number> = {}
  for (const v of last7dVotes ?? []) {
    last7dMap[v.topic_id] = (last7dMap[v.topic_id] ?? 0) + 1
  }

  // ── 5. Filter to drought topics & compute metrics ────────────────────────

  const droughtTopics: DroughtTopic[] = []

  for (const t of topics) {
    const lastVoteAt = lastVoteMap[t.id] ?? null
    const lastArgAt = lastArgMap[t.id] ?? null

    // Most recent activity timestamp
    const lastActivity = [lastVoteAt, lastArgAt]
      .filter(Boolean)
      .sort()
      .pop() ?? null

    // If there's recent activity NEWER than the cutoff, skip
    if (lastActivity && lastActivity > silenceCutoff) continue

    // If no recorded activity in the last 30 days, use topic's created_at as proxy
    // for topics that were also old before the window — treat as max silence
    const effectiveLastActivity = lastActivity ?? t.created_at

    const daysSilent = Math.floor(
      (now - new Date(effectiveLastActivity).getTime()) / (24 * 60 * 60 * 1000)
    )

    // Drought severity: compare last-7d rate to lifetime daily average
    const daysAlive = Math.max(
      1,
      Math.floor((now - new Date(t.created_at).getTime()) / (24 * 60 * 60 * 1000))
    )
    const lifetimeDailyAvg = t.total_votes / daysAlive
    const last7dDaily = (last7dMap[t.id] ?? 0) / 7
    // 0 = completely dried up, 100 = was very active and is now completely dead
    const peakProxy = Math.max(lifetimeDailyAvg, 0.1)
    const rawSeverity = Math.min(100, Math.round((1 - last7dDaily / peakProxy) * 100))
    const drought_severity = Math.max(0, rawSeverity)

    droughtTopics.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      scope: t.scope,
      created_at: t.created_at,
      last_vote_at: lastVoteAt,
      last_argument_at: lastArgAt,
      days_silent: daysSilent,
      peak_daily_votes: Math.round(lifetimeDailyAvg * 100) / 100,
      drought_severity,
    })
  }

  // ── 6. Sort ──────────────────────────────────────────────────────────────
  if (sort === 'silence') {
    droughtTopics.sort((a, b) => b.days_silent - a.days_silent)
  } else if (sort === 'votes') {
    droughtTopics.sort((a, b) => b.total_votes - a.total_votes)
  } else if (sort === 'severity') {
    droughtTopics.sort((a, b) => b.drought_severity - a.drought_severity)
  }

  const trimmed = droughtTopics.slice(0, MAX_RESULTS)

  // ── 7. Stats ─────────────────────────────────────────────────────────────
  const totalSilent = droughtTopics.length
  const avgDaysSilent = totalSilent > 0
    ? Math.round(droughtTopics.reduce((s, t) => s + t.days_silent, 0) / totalSilent)
    : 0
  const longest = droughtTopics[0] ?? null

  const catMap: Record<string, number> = {}
  for (const t of droughtTopics) {
    if (t.category) catMap[t.category] = (catMap[t.category] ?? 0) + 1
  }
  const categories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }))

  const stats: DroughtStats = {
    total_silent: totalSilent,
    avg_days_silent: avgDaysSilent,
    longest_drought_days: longest?.days_silent ?? 0,
    longest_drought_id: sort === 'silence' ? (longest?.id ?? null) : null,
    longest_drought_statement: sort === 'silence' ? (longest?.statement ?? null) : null,
    categories,
  }

  return NextResponse.json({
    topics: trimmed,
    stats,
    window_days: SILENCE_THRESHOLD_DAYS,
    generated_at: new Date().toISOString(),
    has_more: droughtTopics.length > MAX_RESULTS,
  } satisfies DroughtResponse)
}
