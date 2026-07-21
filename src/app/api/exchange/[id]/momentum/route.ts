import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MomentumWindow {
  label: string            // "1h" | "4h" | "24h" | "7d"
  price_start: number      // price at start of window
  price_end: number        // current price
  delta: number            // price_end - price_start
  pct_change: number       // relative change
  direction: 'up' | 'down' | 'flat'
  snapshots: number        // data points in window
}

export interface MomentumPhase {
  name: 'accumulation' | 'breakout' | 'distribution' | 'reversal' | 'consolidation'
  label: string
  description: string
  color: 'for' | 'against' | 'gold' | 'neutral'
}

export interface VelocityBar {
  date: string
  price: number
  velocity: number         // price change vs prev snapshot
  volume: number
}

export interface MomentumResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number          // current price (0-100)
    volume: number         // total votes
    created_at: string
  }
  momentum_score: number           // 0-100 composite
  momentum_direction: 'accelerating' | 'decelerating' | 'stable'
  momentum_label: string           // e.g. "Strong Upward Momentum"
  phase: MomentumPhase
  windows: MomentumWindow[]
  velocity_series: VelocityBar[]   // last 30 data points with velocity
  acceleration: number             // second derivative of price (positive = speeding up)
  volume_growth: number            // pct change in votes per day over last 7d vs prior 7d
  argument_momentum: {
    for_count_7d: number
    against_count_7d: number
    for_count_prev: number
    against_count_prev: number
    net_momentum: number           // positive = FOR gaining, negative = AGAINST gaining
  }
  category_avg_momentum: number | null   // category baseline for comparison
  snapshot_count: number
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function detectPhase(
  windows: MomentumWindow[],
  currentPrice: number,
  acceleration: number,
): MomentumPhase {
  const w24h = windows.find((w) => w.label === '24h')
  const w7d  = windows.find((w) => w.label === '7d')

  const delta24h = w24h?.delta ?? 0
  const delta7d  = w7d?.delta ?? 0
  const absPrice = Math.abs(currentPrice - 50)

  // Breakout: large recent move in a clear direction, accelerating
  if (Math.abs(delta24h) >= 8 && acceleration > 0) {
    return delta24h > 0
      ? { name: 'breakout', label: 'Bullish Breakout', description: 'Strong upward momentum — consensus is surging FOR.', color: 'for' }
      : { name: 'breakout', label: 'Bearish Breakout', description: 'Strong downward momentum — consensus is collapsing AGAINST.', color: 'against' }
  }

  // Reversal: direction change (7d and 24h disagree)
  if (delta7d > 3 && delta24h < -4) {
    return { name: 'reversal', label: 'Bearish Reversal', description: 'Momentum has flipped — gains are being given back.', color: 'against' }
  }
  if (delta7d < -3 && delta24h > 4) {
    return { name: 'reversal', label: 'Bullish Reversal', description: 'Consensus is recovering after a sell-off.', color: 'for' }
  }

  // Distribution: price high but momentum fading
  if (currentPrice >= 65 && acceleration < -0.5) {
    return { name: 'distribution', label: 'Distribution Phase', description: 'Consensus is elevated but momentum is waning — watch for a pullback.', color: 'gold' }
  }

  // Accumulation: price low but momentum building
  if (currentPrice <= 35 && acceleration > 0.5) {
    return { name: 'accumulation', label: 'Accumulation Phase', description: 'Consensus is low but momentum is building — early signs of a FOR recovery.', color: 'for' }
  }

  // Consolidation: tight range, low velocity
  if (absPrice < 12 && Math.abs(delta24h) < 3) {
    return { name: 'consolidation', label: 'Consolidation', description: 'Consensus is range-bound — no clear directional momentum.', color: 'neutral' }
  }

  // Default: trend continuation
  if (delta24h > 2) return { name: 'accumulation', label: 'Upward Trend', description: 'Price is drifting FOR with steady momentum.', color: 'for' }
  if (delta24h < -2) return { name: 'distribution', label: 'Downward Trend', description: 'Price is drifting AGAINST with sustained pressure.', color: 'against' }

  return { name: 'consolidation', label: 'Consolidation', description: 'No dominant momentum direction — market is balanced.', color: 'neutral' }
}

function momentumLabel(score: number, direction: string): string {
  if (score >= 80 && direction === 'accelerating') return 'Strong Upward Momentum'
  if (score >= 65) return 'Moderate Upward Momentum'
  if (score >= 55) return 'Lean Bullish Momentum'
  if (score <= 20 && direction === 'accelerating') return 'Strong Downward Momentum'
  if (score <= 35) return 'Moderate Downward Momentum'
  if (score <= 45) return 'Lean Bearish Momentum'
  return 'Neutral Momentum'
}

// ─── GET /api/exchange/[id]/momentum ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const supabase = await createClient()

  // ── Topic ─────────────────────────────────────────────────────────────────

  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', id)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const currentPrice = Math.round((topic.blue_pct as number) ?? 50)
  const currentVolume = (topic.total_votes as number) ?? 0
  const category = (topic.category as string | null) ?? null

  // ── Price history (all snapshots) ─────────────────────────────────────────

  const { data: rawHistory } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(500)

  const history = (rawHistory ?? []) as Array<{ price: number; volume: number; recorded_at: string }>

  // Always include a live synthetic point
  const now = new Date().toISOString()
  if (history.length === 0 || history[history.length - 1].price !== currentPrice) {
    history.push({ price: currentPrice, volume: currentVolume, recorded_at: now })
  }

  // ── Time-window computations ──────────────────────────────────────────────

  const nowMs = Date.now()
  const WINDOWS: Array<{ label: string; ms: number }> = [
    { label: '1h',  ms: 1 * 3_600_000 },
    { label: '4h',  ms: 4 * 3_600_000 },
    { label: '24h', ms: 24 * 3_600_000 },
    { label: '7d',  ms: 7 * 86_400_000 },
  ]

  const windows: MomentumWindow[] = WINDOWS.map(({ label, ms }) => {
    const cutoff = new Date(nowMs - ms).toISOString()
    const windowSnaps = history.filter((h) => h.recorded_at >= cutoff)
    const startSnap = windowSnaps[0] ?? history[0]
    const endSnap = history[history.length - 1]

    const price_start = startSnap?.price ?? currentPrice
    const price_end = endSnap?.price ?? currentPrice
    const delta = price_end - price_start
    const pct_change = price_start !== 0 ? (delta / price_start) * 100 : 0

    return {
      label,
      price_start: Math.round(price_start),
      price_end: Math.round(price_end),
      delta: Math.round(delta * 10) / 10,
      pct_change: Math.round(pct_change * 10) / 10,
      direction: delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat',
      snapshots: windowSnaps.length,
    }
  })

  // ── Velocity series (last 30 snapshots with per-step velocity) ────────────

  const recent = history.slice(-31)
  const velocity_series: VelocityBar[] = recent.slice(1).map((snap, i) => {
    const prev = recent[i]
    return {
      date: snap.recorded_at,
      price: Math.round(snap.price),
      velocity: Math.round((snap.price - prev.price) * 10) / 10,
      volume: snap.volume,
    }
  })

  // ── Acceleration (2nd derivative) ─────────────────────────────────────────

  // Compare velocity in last 5 snapshots vs previous 5
  const lastVelocities  = velocity_series.slice(-5).map((b) => b.velocity)
  const priorVelocities = velocity_series.slice(-10, -5).map((b) => b.velocity)

  const avgLast  = lastVelocities.length  ? lastVelocities.reduce((a, b) => a + b, 0)  / lastVelocities.length  : 0
  const avgPrior = priorVelocities.length ? priorVelocities.reduce((a, b) => a + b, 0) / priorVelocities.length : 0
  const acceleration = Math.round((avgLast - avgPrior) * 100) / 100

  // ── Momentum score (0-100) ────────────────────────────────────────────────

  // Components:
  // 1. Price position: how far from 50 (in FOR direction)
  const positionComponent = clamp((currentPrice - 50) * 2 + 50, 0, 100)

  // 2. Recent velocity: 24h delta mapped to 0-100
  const w24h = windows.find((w) => w.label === '24h')
  const velocityComponent = clamp((w24h?.delta ?? 0) * 5 + 50, 0, 100)

  // 3. Acceleration component
  const accelComponent = clamp(acceleration * 50 + 50, 0, 100)

  // Weighted composite
  const momentumScore = Math.round(
    positionComponent * 0.4 +
    velocityComponent * 0.4 +
    accelComponent    * 0.2,
  )

  const momentumDirection: 'accelerating' | 'decelerating' | 'stable' =
    Math.abs(acceleration) < 0.2
      ? 'stable'
      : acceleration > 0
      ? 'accelerating'
      : 'decelerating'

  // ── Volume growth ─────────────────────────────────────────────────────────

  const cutoff7d  = new Date(nowMs - 7  * 86_400_000).toISOString()
  const cutoff14d = new Date(nowMs - 14 * 86_400_000).toISOString()

  const snaps7d  = history.filter((h) => h.recorded_at >= cutoff7d)
  const snaps14d = history.filter((h) => h.recorded_at >= cutoff14d && h.recorded_at < cutoff7d)

  const votes7d_start = snaps7d[0]?.volume ?? currentVolume
  const votes7d_end   = snaps7d[snaps7d.length - 1]?.volume ?? currentVolume
  const votes14d_start = snaps14d[0]?.volume ?? votes7d_start
  const votes14d_end   = snaps14d[snaps14d.length - 1]?.volume ?? votes7d_start

  const growth7d  = votes7d_end  - votes7d_start
  const growth14d = votes14d_end - votes14d_start
  const volume_growth =
    growth14d > 0
      ? Math.round(((growth7d - growth14d) / growth14d) * 100)
      : growth7d > 0
      ? 100
      : 0

  // ── Argument momentum ─────────────────────────────────────────────────────

  const cutoffArgs7d  = new Date(nowMs - 7  * 86_400_000).toISOString()
  const cutoffArgs14d = new Date(nowMs - 14 * 86_400_000).toISOString()

  const { data: args7d } = await supabase
    .from('arguments')
    .select('side')
    .eq('topic_id', id)
    .gte('created_at', cutoffArgs7d)

  const { data: argsPrev } = await supabase
    .from('arguments')
    .select('side')
    .eq('topic_id', id)
    .gte('created_at', cutoffArgs14d)
    .lt('created_at', cutoffArgs7d)

  const for_count_7d     = (args7d  ?? []).filter((a: { side: string }) => a.side === 'for').length
  const against_count_7d = (args7d  ?? []).filter((a: { side: string }) => a.side === 'against').length
  const for_count_prev   = (argsPrev ?? []).filter((a: { side: string }) => a.side === 'for').length
  const against_count_prev = (argsPrev ?? []).filter((a: { side: string }) => a.side === 'against').length

  const argNetNow  = for_count_7d - against_count_7d
  const argNetPrev = for_count_prev - against_count_prev
  const net_momentum = argNetNow - argNetPrev

  // ── Category average momentum ─────────────────────────────────────────────

  let category_avg_momentum: number | null = null

  if (category) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('id, blue_pct')
      .eq('category', category)
      .eq('status', 'active')
      .neq('id', id)
      .limit(20)

    if (catTopics && catTopics.length > 0) {
      const avgPrice = catTopics.reduce((s: number, t: { blue_pct: number | null }) => s + (t.blue_pct ?? 50), 0) / catTopics.length
      category_avg_momentum = Math.round(clamp((avgPrice - 50) * 2 + 50, 0, 100))
    }
  }

  // ── Phase detection ───────────────────────────────────────────────────────

  const phase = detectPhase(windows, currentPrice, acceleration)

  // ── Build response ────────────────────────────────────────────────────────

  const result: MomentumResponse = {
    topic: {
      id: topic.id as string,
      statement: topic.statement as string,
      category,
      status: topic.status as string,
      price: currentPrice,
      volume: currentVolume,
      created_at: topic.created_at as string,
    },
    momentum_score: momentumScore,
    momentum_direction: momentumDirection,
    momentum_label: momentumLabel(momentumScore, momentumDirection),
    phase,
    windows,
    velocity_series,
    acceleration,
    volume_growth,
    argument_momentum: {
      for_count_7d,
      against_count_7d,
      for_count_prev,
      against_count_prev,
      net_momentum,
    },
    category_avg_momentum,
    snapshot_count: history.length,
    as_of: now,
  }

  return NextResponse.json(result)
}
