import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MomentumTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  votes_24h: number
  votes_6h: number
  votes_1h: number
  /** votes_6h / 6 — current pace in votes/hour */
  velocity: number
  /** velocity vs the 24h average: positive = accelerating, negative = decelerating */
  acceleration: number
}

export interface MomentumResponse {
  topics: MomentumTopic[]
  window: {
    total_votes_24h: number
    unique_topics: number
    hottest_hour: string | null
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const ms24h = 24 * 60 * 60 * 1000
  const ms6h  =  6 * 60 * 60 * 1000
  const ms1h  =  1 * 60 * 60 * 1000

  const since24h = new Date(now - ms24h).toISOString()
  const since6h  = new Date(now - ms6h).toISOString()
  const since1h  = new Date(now - ms1h).toISOString()

  // Pull all votes from the last 24 hours. Limit 20 000 — well above any
  // realistic volume for an early-stage platform.
  const { data: recentVotes, error } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', since24h)
    .limit(20000)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }

  const votes = recentVotes ?? []

  if (votes.length === 0) {
    return NextResponse.json({
      topics: [],
      window: { total_votes_24h: 0, unique_topics: 0, hottest_hour: null },
    } satisfies MomentumResponse)
  }

  // ── Count per topic ────────────────────────────────────────────────────────
  const counts24h = new Map<string, number>()
  const counts6h  = new Map<string, number>()
  const counts1h  = new Map<string, number>()

  // Also track hourly buckets for "hottest hour" computation
  const hourBuckets = new Map<string, number>()

  for (const v of votes) {
    const tid = v.topic_id
    counts24h.set(tid, (counts24h.get(tid) ?? 0) + 1)
    if (v.created_at >= since6h) counts6h.set(tid, (counts6h.get(tid) ?? 0) + 1)
    if (v.created_at >= since1h) counts1h.set(tid, (counts1h.get(tid) ?? 0) + 1)

    // hourly bucket for global hottest-hour stat
    const hourKey = v.created_at.slice(0, 13) + ':00:00Z'
    hourBuckets.set(hourKey, (hourBuckets.get(hourKey) ?? 0) + 1)
  }

  // Top 30 topics by 24h votes
  const topIds = Array.from(counts24h.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([id]) => id)

  if (topIds.length === 0) {
    return NextResponse.json({
      topics: [],
      window: { total_votes_24h: votes.length, unique_topics: 0, hottest_hour: null },
    } satisfies MomentumResponse)
  }

  // Fetch topic details for the top IDs
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topIds)
    .not('status', 'in', '("failed","law")')

  const topics = (topicsData ?? []).map((t) => {
    const v24 = counts24h.get(t.id) ?? 0
    const v6  = counts6h.get(t.id) ?? 0
    const v1  = counts1h.get(t.id) ?? 0

    // Pace in votes/hour based on the 6h window (more responsive than 24h avg)
    const velocity = v6 / 6

    // Acceleration: current velocity vs 24h average
    // 24h avg pace = v24 / 24 votes/hour
    const avgPace24h = v24 / 24
    const acceleration = velocity - avgPace24h

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      votes_24h: v24,
      votes_6h: v6,
      votes_1h: v1,
      velocity: Math.round(velocity * 10) / 10,
      acceleration: Math.round(acceleration * 10) / 10,
    }
  })

  // Sort by velocity (6h pace), then 24h count as tiebreaker
  topics.sort((a, b) => b.velocity - a.velocity || b.votes_24h - a.votes_24h)

  // Hottest hour globally
  const hottestHour = Array.from(hourBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .at(0)?.[0] ?? null

  return NextResponse.json({
    topics,
    window: {
      total_votes_24h: votes.length,
      unique_topics: counts24h.size,
      hottest_hour: hottestHour,
    },
  } satisfies MomentumResponse)
}
