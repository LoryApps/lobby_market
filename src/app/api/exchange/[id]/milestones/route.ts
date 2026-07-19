import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceMilestone {
  threshold: number
  label: string
  description: string
  tier: 'neutral' | 'lean' | 'strong' | 'super' | 'dominant' | 'law'
  /** ISO timestamp when threshold was first crossed upward, or null if not yet reached */
  crossed_at: string | null
  /** Volume (total votes) at time of crossing */
  crossed_at_volume: number | null
  /** Price at time of crossing */
  crossed_at_price: number | null
  /** Days from market open to crossing */
  days_to_cross: number | null
  /** Whether currently above this threshold */
  is_current: boolean
  /** Whether the market has crossed this and stayed above it */
  is_achieved: boolean
}

export interface MilestoneVelocity {
  /** Price change in last 7 days */
  delta_7d: number | null
  /** Estimated days to next milestone at current velocity */
  days_to_next: number | null
  /** Current daily vote rate */
  daily_votes_rate: number
}

export interface MarketMilestones {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  total_votes: number
  created_at: string

  milestones: PriceMilestone[]
  velocity: MilestoneVelocity
  next_milestone: PriceMilestone | null
  last_milestone: PriceMilestone | null

  /** Snapshot count for health check */
  snapshot_count: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THRESHOLDS: Array<{
  threshold: number
  label: string
  description: string
  tier: PriceMilestone['tier']
}> = [
  { threshold: 25, label: '25¢', description: 'One-quarter consensus', tier: 'neutral' },
  { threshold: 33, label: '33¢', description: 'One-third support', tier: 'neutral' },
  { threshold: 50, label: '50¢', description: 'Majority flip', tier: 'lean' },
  { threshold: 55, label: '55¢', description: 'Lean consensus', tier: 'lean' },
  { threshold: 60, label: '60¢', description: 'Strong lean', tier: 'strong' },
  { threshold: 67, label: '67¢', description: 'Supermajority — Law threshold', tier: 'law' },
  { threshold: 75, label: '75¢', description: 'Three-quarter consensus', tier: 'dominant' },
  { threshold: 90, label: '90¢', description: 'Near-unanimous', tier: 'dominant' },
]

// ─── GET /api/exchange/[id]/milestones ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', id)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const currentPrice = topic.blue_pct ?? 50
  const openedAt = new Date(topic.created_at).getTime()

  // ── 2. Price history ──────────────────────────────────────────────────────
  const { data: history } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(2000)

  const snaps = history ?? []

  // ── 3. Detect first crossing for each threshold (upward) ─────────────────
  const crossings = new Map<
    number,
    { crossed_at: string; crossed_at_volume: number; crossed_at_price: number }
  >()

  let prevPrice = snaps[0]?.price ?? 50

  for (const snap of snaps) {
    for (const { threshold } of THRESHOLDS) {
      if (!crossings.has(threshold)) {
        if (prevPrice < threshold && snap.price >= threshold) {
          crossings.set(threshold, {
            crossed_at: snap.recorded_at,
            crossed_at_volume: snap.volume,
            crossed_at_price: snap.price,
          })
        }
      }
    }
    prevPrice = snap.price
  }

  // Also detect if current price is above threshold (even without history)
  for (const { threshold } of THRESHOLDS) {
    if (!crossings.has(threshold) && currentPrice >= threshold) {
      // Market is above threshold but we have no snapshot data — use topic created_at
      crossings.set(threshold, {
        crossed_at: topic.created_at,
        crossed_at_volume: topic.total_votes ?? 0,
        crossed_at_price: currentPrice,
      })
    }
  }

  // ── 4. Build milestone array ───────────────────────────────────────────────
  const milestones: PriceMilestone[] = THRESHOLDS.map(({ threshold, label, description, tier }) => {
    const crossing = crossings.get(threshold)
    const isAchieved = currentPrice >= threshold
    const isCurrent = threshold === Math.max(...THRESHOLDS.map((t) => t.threshold).filter((t) => currentPrice >= t), 0)

    let daysToCross: number | null = null
    if (crossing) {
      const crossedAt = new Date(crossing.crossed_at).getTime()
      daysToCross = Math.max(0, Math.round((crossedAt - openedAt) / 86_400_000))
    }

    return {
      threshold,
      label,
      description,
      tier,
      crossed_at: crossing?.crossed_at ?? null,
      crossed_at_volume: crossing?.crossed_at_volume ?? null,
      crossed_at_price: crossing?.crossed_at_price ?? null,
      days_to_cross: daysToCross,
      is_current: isCurrent,
      is_achieved: isAchieved,
    }
  })

  // ── 5. Velocity ───────────────────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
  const recentSnaps = snaps.filter((s) => new Date(s.recorded_at) >= sevenDaysAgo)
  const delta7d =
    recentSnaps.length >= 2
      ? recentSnaps[recentSnaps.length - 1].price - recentSnaps[0].price
      : null

  const daysActive = Math.max(1, Math.round((Date.now() - openedAt) / 86_400_000))
  const dailyVotesRate = (topic.total_votes ?? 0) / daysActive

  // Estimate days to next milestone
  let daysToNext: number | null = null
  const nextMilestoneThreshold = THRESHOLDS.find((t) => t.threshold > currentPrice)
  if (nextMilestoneThreshold && delta7d !== null && delta7d > 0) {
    const gap = nextMilestoneThreshold.threshold - currentPrice
    const dailyDelta = delta7d / 7
    daysToNext = dailyDelta > 0.01 ? Math.round(gap / dailyDelta) : null
  }

  const velocity: MilestoneVelocity = {
    delta_7d: delta7d,
    days_to_next: daysToNext,
    daily_votes_rate: Math.round(dailyVotesRate * 10) / 10,
  }

  // ── 6. Next / last milestone ──────────────────────────────────────────────
  const nextMilestone = milestones.find((m) => !m.is_achieved) ?? null
  const lastMilestone = [...milestones].reverse().find((m) => m.is_achieved) ?? null

  const response: MarketMilestones = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    current_price: currentPrice,
    total_votes: topic.total_votes ?? 0,
    created_at: topic.created_at,
    milestones,
    velocity,
    next_milestone: nextMilestone,
    last_milestone: lastMilestone,
    snapshot_count: snaps.length,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}
