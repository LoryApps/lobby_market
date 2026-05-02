import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RacerTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  votes_1h: number
  votes_6h: number
  /** votes/hour in the last 6h window */
  velocity: number
  /** positive = trending FOR, negative = trending AGAINST */
  momentum: number
  /** distance to next threshold: 51% or 67% */
  gap_to_majority: number | null
  gap_to_law: number | null
  /** Estimated hours to reach next threshold at current velocity */
  eta_hours: number | null
  rank: number
}

export interface RaceResponse {
  racers: RacerTopic[]
  total_active: number
  fastest_velocity: number
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAW_THRESHOLD = 67
const MAJORITY_THRESHOLD = 51
const MAX_RACERS = 12

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const since1h = new Date(now - 1 * 60 * 60 * 1000).toISOString()
  const since6h = new Date(now - 6 * 60 * 60 * 1000).toISOString()

  // Fetch active/voting topics
  const { data: topicsRaw, error: topicsError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['proposed', 'active', 'voting'])
    .gt('total_votes', 0)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (topicsError) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const topics = topicsRaw ?? []
  if (topics.length === 0) {
    return NextResponse.json({
      racers: [],
      total_active: 0,
      fastest_velocity: 0,
      generated_at: new Date().toISOString(),
    } satisfies RaceResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // Fetch recent vote counts (1h and 6h windows) in one pass
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('topic_id, created_at, side')
    .in('topic_id', topicIds)
    .gte('created_at', since6h)
    .limit(50000)

  const votesArr = recentVotes ?? []

  // Bucket votes by topic and time window
  const counts1h = new Map<string, { blue: number; red: number }>()
  const counts6h = new Map<string, { blue: number; red: number }>()

  for (const v of votesArr) {
    const id = v.topic_id
    const isRecent = v.created_at >= since1h

    if (!counts6h.has(id)) counts6h.set(id, { blue: 0, red: 0 })
    const c6 = counts6h.get(id)!
    if (v.side === 'for') c6.blue++
    else c6.red++

    if (isRecent) {
      if (!counts1h.has(id)) counts1h.set(id, { blue: 0, red: 0 })
      const c1 = counts1h.get(id)!
      if (v.side === 'for') c1.blue++
      else c1.red++
    }
  }

  // Build racer objects
  const racers: Omit<RacerTopic, 'rank'>[] = topics.map((t) => {
    const c1 = counts1h.get(t.id) ?? { blue: 0, red: 0 }
    const c6 = counts6h.get(t.id) ?? { blue: 0, red: 0 }
    const votes1h = c1.blue + c1.red
    const votes6h = c6.blue + c6.red
    const velocity = votes6h / 6 // votes/hour

    // Recent direction bias
    const recent_blue_pct = votes6h > 0 ? (c6.blue / votes6h) * 100 : t.blue_pct ?? 50
    const momentum = Math.round(recent_blue_pct - (t.blue_pct ?? 50))

    const bluePct = t.blue_pct ?? 50

    // Gap to thresholds (null if already past them)
    const gap_to_majority = bluePct < MAJORITY_THRESHOLD
      ? Math.round((MAJORITY_THRESHOLD - bluePct) * 10) / 10
      : null
    const gap_to_law = bluePct < LAW_THRESHOLD
      ? Math.round((LAW_THRESHOLD - bluePct) * 10) / 10
      : null

    // ETA: how many hours at current velocity to close the gap
    let eta_hours: number | null = null
    if (velocity > 0 && (gap_to_majority !== null || gap_to_law !== null)) {
      const gap = gap_to_majority ?? gap_to_law!
      const totalVotes = t.total_votes ?? 1
      // Approximate votes needed to shift pct by `gap`
      const votesNeeded = (gap * totalVotes) / Math.max(1, 100 - bluePct)
      eta_hours = Math.round((votesNeeded / velocity) * 10) / 10
    }

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: Math.round((t.blue_pct ?? 50) * 10) / 10,
      total_votes: t.total_votes ?? 0,
      votes_1h: votes1h,
      votes_6h: votes6h,
      velocity: Math.round(velocity * 10) / 10,
      momentum,
      gap_to_majority,
      gap_to_law,
      eta_hours,
    }
  })

  // Sort by velocity (most active first), then by total_votes as tiebreaker
  racers.sort((a, b) => b.velocity - a.velocity || b.total_votes - a.total_votes)

  const top = racers.slice(0, MAX_RACERS)
  const ranked: RacerTopic[] = top.map((r, i) => ({ ...r, rank: i + 1 }))
  const fastestVelocity = ranked[0]?.velocity ?? 0

  return NextResponse.json({
    racers: ranked,
    total_active: topics.length,
    fastest_velocity: fastestVelocity,
    generated_at: new Date().toISOString(),
  } satisfies RaceResponse)
}
