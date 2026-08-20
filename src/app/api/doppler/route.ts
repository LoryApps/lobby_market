import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export type DopplerQuadrant =
  | 'launching'        // high velocity + moving FOR
  | 'crashing'         // high velocity + moving AGAINST
  | 'drifting_for'     // low velocity + moving FOR
  | 'drifting_against' // low velocity + moving AGAINST
  | 'parked'           // very low velocity + stable direction

export interface DopplerTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  // Scatter coordinates (normalised 0–1 for the canvas)
  velocity: number        // votes/day over last 3 days (absolute)
  direction: number       // blue_pct change over last 7 days (positive = FOR, negative = AGAINST)
  quadrant: DopplerQuadrant
  // Position on unit square [0..1, 0..1] for the canvas
  x: number               // velocity (0 = idle, 1 = fastest)
  y: number               // direction (0 = hardest AGAINST, 1 = hardest FOR)
}

export interface DopplerStats {
  total_analyzed: number
  median_velocity: number
  launching_count: number
  crashing_count: number
  avg_direction: number   // positive = platform trending FOR overall
  most_active: DopplerTopic | null
  sharpest_reversal: DopplerTopic | null
  sharpest_surge: DopplerTopic | null
}

export interface DopplerResponse {
  topics: DopplerTopic[]
  stats: DopplerStats
  generatedAt: string
}

// ─── GET /api/doppler ─────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // Fetch active / voting topics
  const { data: topicRows, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (topicError || !topicRows) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  if (topicRows.length === 0) {
    return NextResponse.json({
      topics: [],
      stats: {
        total_analyzed: 0,
        median_velocity: 0,
        launching_count: 0,
        crashing_count: 0,
        avg_direction: 0,
        most_active: null,
        sharpest_reversal: null,
        sharpest_surge: null,
      },
      generatedAt: new Date().toISOString(),
    } satisfies DopplerResponse)
  }

  const topicIds = topicRows.map((t) => t.id)

  // Fetch last 10 price snapshots per topic (enough for velocity + direction calc)
  const now = new Date()
  const cutoff7d = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const cutoff3d = new Date(now.getTime() - 3 * 86_400_000).toISOString()

  const { data: priceRows } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, volume, recorded_at')
    .in('topic_id', topicIds)
    .gte('recorded_at', cutoff7d)
    .order('recorded_at', { ascending: false })

  // Group price history by topic
  const historyByTopic = new Map<string, { price: number; volume: number; recorded_at: string }[]>()
  for (const row of priceRows ?? []) {
    const arr = historyByTopic.get(row.topic_id) ?? []
    arr.push({ price: row.price, volume: row.volume, recorded_at: row.recorded_at })
    historyByTopic.set(row.topic_id, arr)
  }

  // Build doppler data for each topic
  const rawTopics: { velocity: number; direction: number; topic: typeof topicRows[0] }[] = []

  for (const topic of topicRows) {
    const history = historyByTopic.get(topic.id) ?? []

    // Current values (most recent snapshot or live topic data)
    const currentPrice = topic.blue_pct ?? 50
    const currentVolume = topic.total_votes ?? 0

    // Price 7 days ago (oldest snapshot we have)
    const oldestSnapshot = history.length > 0 ? history[history.length - 1] : null
    const price7dAgo = oldestSnapshot?.price ?? currentPrice

    // Volume 3 days ago (find snapshot closest to 3d ago)
    const snap3d = history.find((h) => h.recorded_at <= cutoff3d)
    const volume3dAgo = snap3d?.volume ?? 0

    // Direction: change in blue_pct over 7 days (+ve = gaining FOR support)
    const direction = currentPrice - price7dAgo

    // Velocity: votes per day over last 3 days
    const votesInLast3d = currentVolume - volume3dAgo
    const velocity = Math.max(0, votesInLast3d / 3)

    rawTopics.push({ velocity, direction, topic })
  }

  // Normalise velocity to [0..1] using 95th percentile as ceiling
  const velocities = rawTopics.map((r) => r.velocity).sort((a, b) => a - b)
  const p95velocity = velocities[Math.floor(velocities.length * 0.95)] || 1
  const maxVelocity = Math.max(p95velocity, 1)

  // Normalise direction to [0..1]: direction ranges roughly -50 to +50 pp
  const directions = rawTopics.map((r) => r.direction)
  const maxAbsDirection = Math.max(...directions.map(Math.abs), 1)

  const topics: DopplerTopic[] = rawTopics.map(({ velocity, direction, topic }) => {
    const normVelocity = Math.min(1, velocity / maxVelocity)
    // y: 0.5 = neutral, 1 = full FOR, 0 = full AGAINST
    const normDirection = 0.5 + (direction / (maxAbsDirection * 2))
    const clampedY = Math.max(0, Math.min(1, normDirection))

    // Classify quadrant
    const isHighVelocity = normVelocity >= 0.35
    const movingFor = direction > 1.5
    const movingAgainst = direction < -1.5

    let quadrant: DopplerQuadrant
    if (normVelocity < 0.15 && Math.abs(direction) < 2) {
      quadrant = 'parked'
    } else if (isHighVelocity && movingFor) {
      quadrant = 'launching'
    } else if (isHighVelocity && movingAgainst) {
      quadrant = 'crashing'
    } else if (!isHighVelocity && movingFor) {
      quadrant = 'drifting_for'
    } else if (!isHighVelocity && movingAgainst) {
      quadrant = 'drifting_against'
    } else {
      quadrant = 'parked'
    }

    return {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      velocity,
      direction,
      quadrant,
      x: normVelocity,
      y: clampedY,
    }
  })

  // Compute stats
  const sortedByVelocity = [...topics].sort((a, b) => b.velocity - a.velocity)
  const medianIdx = Math.floor(sortedByVelocity.length / 2)
  const medianVelocity = sortedByVelocity[medianIdx]?.velocity ?? 0

  const launchingTopics = topics.filter((t) => t.quadrant === 'launching')
  const crashingTopics = topics.filter((t) => t.quadrant === 'crashing')
  const avgDirection = topics.reduce((sum, t) => sum + t.direction, 0) / Math.max(1, topics.length)

  const mostActive = sortedByVelocity[0] ?? null
  const sharpestSurge = [...topics].sort((a, b) => b.direction - a.direction)[0] ?? null
  const sharpestReversal = [...topics].sort((a, b) => a.direction - b.direction)[0] ?? null

  return NextResponse.json({
    topics,
    stats: {
      total_analyzed: topics.length,
      median_velocity: Math.round(medianVelocity * 10) / 10,
      launching_count: launchingTopics.length,
      crashing_count: crashingTopics.length,
      avg_direction: Math.round(avgDirection * 10) / 10,
      most_active: mostActive,
      sharpest_reversal: sharpestReversal,
      sharpest_surge: sharpestSurge,
    },
    generatedAt: new Date().toISOString(),
  } satisfies DopplerResponse)
}
