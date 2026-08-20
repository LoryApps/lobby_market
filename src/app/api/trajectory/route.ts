import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 180

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrajectoryLabel =
  | 'surging'     // blue_pct rising fast (≥+8pp in recent window)
  | 'gaining'     // blue_pct rising moderately (+3–8pp)
  | 'stable'      // minimal movement (within ±3pp)
  | 'declining'   // blue_pct falling moderately (−3 to −8pp)
  | 'reversing'   // blue_pct falling fast (≤−8pp)
  | 'oscillating' // high variance with no clear direction

export interface TrajectoryTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  trajectory: TrajectoryLabel
  momentum: number          // pp change over measurement window (positive = FOR gaining)
  acceleration: number      // change in momentum (positive = speeding up in current direction)
  volume_trend: 'growing' | 'stable' | 'shrinking'
  pivot_risk: boolean       // within 5pp of 50% AND momentum moving toward 50%
  days_active: number
}

export interface TrajectorySection {
  label: TrajectoryLabel
  icon: string
  topics: TrajectoryTopic[]
}

export interface TrajectoryStats {
  surging_count: number
  reversing_count: number
  stable_count: number
  avg_momentum: number       // platform-wide average |momentum| (how much is moving)
  highest_momentum_topic: TrajectoryTopic | null
  fastest_reversal_topic: TrajectoryTopic | null
}

export interface TrajectoryResponse {
  sections: TrajectorySection[]
  stats: TrajectoryStats
  total_analyzed: number
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyTrajectory(
  momentum: number,
  acceleration: number,
  variance: number
): TrajectoryLabel {
  if (variance > 15 && Math.abs(momentum) < 5) return 'oscillating'
  if (momentum >= 8) return 'surging'
  if (momentum >= 3) return 'gaining'
  if (momentum <= -8) return 'reversing'
  if (momentum <= -3) return 'declining'
  return 'stable'
}

function volumeTrend(
  recentVolume: number,
  olderVolume: number
): 'growing' | 'stable' | 'shrinking' {
  if (olderVolume === 0) return recentVolume > 0 ? 'growing' : 'stable'
  const ratio = recentVolume / Math.max(1, olderVolume)
  if (ratio >= 1.2) return 'growing'
  if (ratio <= 0.8) return 'shrinking'
  return 'stable'
}

// ─── GET /api/trajectory ──────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // Fetch active & voting topics with their recent price history
  const { data: topicRows, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 3)
    .order('total_votes', { ascending: false })
    .limit(300)

  if (topicError || !topicRows) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  // Fetch recent price history for all these topics (last 14 data points per topic)
  const topicIds = topicRows.map((t) => t.id)

  const { data: historyRows } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, volume, recorded_at')
    .in('topic_id', topicIds)
    .order('recorded_at', { ascending: false })

  // Group history by topic
  const historyMap = new Map<string, Array<{ price: number; volume: number; recorded_at: string }>>()
  for (const row of historyRows ?? []) {
    const r = row as { topic_id: string; price: number; volume: number; recorded_at: string }
    const bucket = historyMap.get(r.topic_id) ?? []
    if (bucket.length < 14) bucket.push({ price: r.price, volume: r.volume, recorded_at: r.recorded_at })
    historyMap.set(r.topic_id, bucket)
  }

  const topics: TrajectoryTopic[] = []

  for (const t of topicRows) {
    const row = t as {
      id: string; statement: string; category: string | null; status: string
      blue_pct: number; total_votes: number; created_at: string
    }
    const history = historyMap.get(row.id) ?? []

    const currentPct = row.blue_pct ?? 50
    const daysActive = Math.max(
      1,
      Math.round((Date.now() - new Date(row.created_at).getTime()) / 86400000)
    )

    // Compute momentum from price history
    let momentum = 0
    let acceleration = 0
    let variance = 0

    if (history.length >= 2) {
      const latest = history[0].price
      const midpoint = history[Math.min(3, history.length - 1)].price
      const oldest = history[history.length - 1].price

      // Recent momentum: last vs mid-window
      const recentMomentum = latest - midpoint
      // Earlier momentum: mid vs oldest
      const earlierMomentum = midpoint - oldest

      momentum = recentMomentum
      acceleration = recentMomentum - earlierMomentum

      // Variance: spread of values
      const prices = history.map((h) => h.price)
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length
      variance = Math.sqrt(prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length)
    } else {
      // No price history — use blue_pct deviation from 50 as a rough proxy
      momentum = 0
      acceleration = 0
      variance = 0
    }

    const trajectory = classifyTrajectory(momentum, acceleration, variance)

    // Volume trend: compare recent vs older windows
    const recentVol = history.slice(0, 3).reduce((a, h) => a + h.volume, 0)
    const olderVol = history.slice(3, 7).reduce((a, h) => a + h.volume, 0)
    const volTrend = volumeTrend(recentVol, olderVol)

    // Pivot risk: near 50/50 AND momentum toward 50%
    const distanceFrom50 = Math.abs(currentPct - 50)
    const movingToward50 = (currentPct > 50 && momentum < 0) || (currentPct < 50 && momentum > 0)
    const pivotRisk = distanceFrom50 <= 5 && movingToward50

    topics.push({
      id: row.id,
      statement: row.statement,
      category: row.category,
      status: row.status,
      blue_pct: currentPct,
      total_votes: row.total_votes,
      trajectory,
      momentum: Math.round(momentum * 10) / 10,
      acceleration: Math.round(acceleration * 10) / 10,
      volume_trend: volTrend,
      pivot_risk: pivotRisk,
      days_active: daysActive,
    })
  }

  // Build sections
  const SECTION_ORDER: TrajectoryLabel[] = ['surging', 'gaining', 'oscillating', 'stable', 'declining', 'reversing']
  const SECTION_ICONS: Record<TrajectoryLabel, string> = {
    surging:     '🚀',
    gaining:     '📈',
    oscillating: '🔄',
    stable:      '➡️',
    declining:   '📉',
    reversing:   '⬇️',
  }

  const grouped = new Map<TrajectoryLabel, TrajectoryTopic[]>()
  for (const t of topics) {
    const bucket = grouped.get(t.trajectory) ?? []
    bucket.push(t)
    grouped.set(t.trajectory, bucket)
  }

  const sections: TrajectorySection[] = SECTION_ORDER
    .filter((label) => (grouped.get(label) ?? []).length > 0)
    .map((label) => {
      const rawBucket = grouped.get(label) ?? []
      // Sort: surging/gaining by momentum desc; reversing/declining by momentum asc; others by total_votes desc
      let sorted: TrajectoryTopic[]
      if (label === 'surging' || label === 'gaining') {
        sorted = rawBucket.sort((a, b) => b.momentum - a.momentum)
      } else if (label === 'reversing' || label === 'declining') {
        sorted = rawBucket.sort((a, b) => a.momentum - b.momentum)
      } else {
        sorted = rawBucket.sort((a, b) => b.total_votes - a.total_votes)
      }
      return { label, icon: SECTION_ICONS[label], topics: sorted.slice(0, 8) }
    })

  // Stats
  const surging = topics.filter((t) => t.trajectory === 'surging')
  const reversing = topics.filter((t) => t.trajectory === 'reversing')
  const avgMomentum =
    topics.length > 0
      ? topics.reduce((a, t) => a + Math.abs(t.momentum), 0) / topics.length
      : 0

  const highestMomentum =
    topics
      .filter((t) => t.trajectory === 'surging' || t.trajectory === 'gaining')
      .sort((a, b) => b.momentum - a.momentum)[0] ?? null

  const fastestReversal =
    topics
      .filter((t) => t.trajectory === 'reversing' || t.trajectory === 'declining')
      .sort((a, b) => a.momentum - b.momentum)[0] ?? null

  const stats: TrajectoryStats = {
    surging_count: surging.length,
    reversing_count: reversing.length,
    stable_count: topics.filter((t) => t.trajectory === 'stable').length,
    avg_momentum: Math.round(avgMomentum * 10) / 10,
    highest_momentum_topic: highestMomentum,
    fastest_reversal_topic: fastestReversal,
  }

  const response: TrajectoryResponse = {
    sections,
    stats,
    total_analyzed: topics.length,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=180, stale-while-revalidate=60' },
  })
}
