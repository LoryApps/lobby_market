import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignalFactor {
  key: string
  label: string
  score: number      // 0-100
  direction: 'bullish' | 'bearish' | 'neutral'
  description: string
  weight: number     // relative weight in composite
}

export interface SignalDay {
  date: string
  composite: number  // 0-100
  price: number
}

export interface MarketSignal {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number

  // Composite signal
  composite_score: number    // 0-100
  composite_direction: 'bullish' | 'bearish' | 'neutral'
  composite_label: string    // "Strong Bullish", "Weak Bearish", etc.
  confidence: 'low' | 'medium' | 'high'

  // Individual factors
  factors: SignalFactor[]

  // 30-day signal history
  signal_history: SignalDay[]

  // Key driver (highest weighted signal that's not neutral)
  key_driver: string | null

  // Natural-language summary lines
  summary: string[]

  snapshot_count: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function directionFromScore(score: number, threshold = 55): 'bullish' | 'bearish' | 'neutral' {
  if (score >= threshold) return 'bullish'
  if (score <= 100 - threshold) return 'bearish'
  return 'neutral'
}

function compositeLabel(score: number): string {
  if (score >= 80) return 'Strong Bullish'
  if (score >= 65) return 'Bullish'
  if (score >= 55) return 'Lean Bullish'
  if (score <= 20) return 'Strong Bearish'
  if (score <= 35) return 'Bearish'
  if (score <= 45) return 'Lean Bearish'
  return 'Neutral'
}

// ─── GET /api/exchange/[id]/signal ───────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic core ──────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select(`
      id, statement, category, status,
      blue_pct, blue_votes, red_votes, total_votes,
      created_at, feed_score, view_count
    `)
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const price = Math.round(topic.blue_pct ?? 50)
  const volume = (topic.total_votes ?? 0) as number

  // ── 2. Price history (last 60 days) ────────────────────────────────────────
  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const { data: snapshots } = await supabase
    .from('topic_price_history')
    .select('price_cents, recorded_at')
    .eq('topic_id', id)
    .gte('recorded_at', since60)
    .order('recorded_at', { ascending: true })

  const snaps = snapshots ?? []
  const prices = snaps.map((s) => s.price_cents as number)
  const snapshotCount = prices.length

  // Price stats
  const recentPrices = prices.slice(-7)
  const olderPrices = prices.slice(-30, -7)
  const momentum7d =
    recentPrices.length >= 2
      ? recentPrices[recentPrices.length - 1] - recentPrices[0]
      : null
  const _momentum30d =
    olderPrices.length >= 2 && recentPrices.length >= 1
      ? recentPrices[recentPrices.length - 1] - olderPrices[0]
      : null

  // Std dev (volatility)
  const priceMean =
    prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : price
  const priceStdDev =
    prices.length >= 2
      ? Math.sqrt(prices.reduce((a, v) => a + Math.pow(v - priceMean, 2), 0) / prices.length)
      : 0
  const volatilityScore = clamp(Math.round((priceStdDev / 50) * 100), 0, 100)

  // ── 3. Arguments ──────────────────────────────────────────────────────────
  const { data: args } = await supabase
    .from('arguments')
    .select('side, upvote_count')
    .eq('topic_id', id)

  const argsAll = args ?? []
  const forArgs = argsAll.filter((a) => a.side === 'for')
  const againstArgs = argsAll.filter((a) => a.side === 'against')
  const forScore = forArgs.reduce((s, a) => s + (a.upvote_count ?? 0), 0)
  const againstScore = againstArgs.reduce((s, a) => s + (a.upvote_count ?? 0), 0)
  const totalArgScore = forScore + againstScore

  // ── 4. Active debates ─────────────────────────────────────────────────────
  const { count: activeDebates } = await supabase
    .from('debates')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', id)
    .in('status', ['scheduled', 'live'])

  // ── 5. Coalition consensus ─────────────────────────────────────────────────
  const { data: stances } = await supabase
    .from('coalition_stances')
    .select('stance')
    .eq('topic_id', id)

  const stancesAll = stances ?? []
  const forStances = stancesAll.filter((s) => s.stance === 'for').length
  const againstStances = stancesAll.filter((s) => s.stance === 'against').length
  const totalStances = forStances + againstStances

  // ── 6. Market maturity ────────────────────────────────────────────────────
  const createdAt = new Date(topic.created_at as string)
  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - createdAt.getTime()) / 86_400_000),
  )

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTE INDIVIDUAL SIGNAL FACTORS
  // Each factor produces a score 0-100 where:
  //   > 55 = bullish signal
  //   < 45 = bearish signal
  //   45-55 = neutral
  // ─────────────────────────────────────────────────────────────────────────

  // Factor 1: Price Consensus
  // How far is the price from neutral (50)? Distance = confidence of consensus.
  // Bullish = price > 50, Bearish = price < 50.
  const consensusScore = price  // 0-100, 50 = neutral
  const consensusFactor: SignalFactor = {
    key: 'consensus',
    label: 'Consensus',
    score: consensusScore,
    direction: directionFromScore(consensusScore),
    description:
      consensusScore > 55
        ? `Current FOR consensus at ${consensusScore}¢ — above neutral.`
        : consensusScore < 45
        ? `Current AGAINST consensus at ${100 - consensusScore}¢ — below neutral.`
        : `Market at ${consensusScore}¢ — closely contested.`,
    weight: 2.0,
  }

  // Factor 2: Price Momentum (7-day)
  let momentumScore = 50
  if (momentum7d !== null) {
    // Map momentum range -30..+30 to 0..100
    momentumScore = clamp(50 + (momentum7d / 30) * 50, 0, 100)
  }
  const momentumFactor: SignalFactor = {
    key: 'momentum',
    label: 'Price Momentum',
    score: Math.round(momentumScore),
    direction: directionFromScore(momentumScore),
    description:
      momentum7d === null
        ? 'Insufficient price history to compute 7-day momentum.'
        : momentum7d > 2
        ? `Price gained ${momentum7d.toFixed(1)}¢ over the past 7 days.`
        : momentum7d < -2
        ? `Price lost ${Math.abs(momentum7d).toFixed(1)}¢ over the past 7 days.`
        : 'Price is flat over the past 7 days.',
    weight: 1.8,
  }

  // Factor 3: Volume / Activity
  // High and rising vote volume = bullish engagement (independent of direction).
  // We score this based on absolute volume and feed_score.
  const feedScore = (topic.feed_score ?? 0) as number
  const activityScore = clamp(
    Math.min(
      100,
      (Math.log1p(volume) / Math.log1p(10_000)) * 60 +
        (Math.log1p(feedScore) / Math.log1p(1_000)) * 40,
    ),
    0,
    100,
  )
  // Activity is bullish if price > 50, bearish if price < 50
  const activitySignalScore =
    price >= 50
      ? clamp(50 + activityScore / 2, 0, 100)
      : clamp(50 - activityScore / 2, 0, 100)
  const volumeFactor: SignalFactor = {
    key: 'volume',
    label: 'Vote Activity',
    score: Math.round(activityScore),
    direction:
      activityScore >= 60
        ? (price >= 50 ? 'bullish' : 'bearish')
        : 'neutral',
    description:
      volume >= 10_000
        ? `High market activity — ${volume.toLocaleString()} total votes cast.`
        : volume >= 1_000
        ? `Moderate activity — ${volume.toLocaleString()} votes.`
        : `Early-stage market — ${volume.toLocaleString()} votes so far.`,
    weight: 1.2,
  }
  void activitySignalScore

  // Factor 4: Argument Quality
  // Ratio of FOR argument upvotes to total argument upvotes.
  let argScore = 50
  if (totalArgScore > 0) {
    argScore = Math.round((forScore / totalArgScore) * 100)
  } else if (forArgs.length > 0 || againstArgs.length > 0) {
    argScore = forArgs.length > againstArgs.length ? 60 : 40
  }
  const argumentFactor: SignalFactor = {
    key: 'arguments',
    label: 'Argument Strength',
    score: argScore,
    direction: directionFromScore(argScore),
    description:
      totalArgScore === 0 && argsAll.length === 0
        ? 'No arguments submitted yet.'
        : `FOR arguments hold ${argScore}% of total upvote weight across ${argsAll.length} submissions.`,
    weight: 1.5,
  }

  // Factor 5: Stability (inverse of volatility)
  const stabilityScore = clamp(100 - volatilityScore, 0, 100)
  const stabilityFactor: SignalFactor = {
    key: 'stability',
    label: 'Price Stability',
    score: stabilityScore,
    direction: 'neutral',  // stability is direction-agnostic
    description:
      stabilityScore >= 80
        ? 'Very low volatility — consensus has been stable.'
        : stabilityScore >= 55
        ? 'Moderate volatility — some price fluctuation observed.'
        : 'High volatility — consensus has shifted significantly.',
    weight: 0.8,
  }

  // Factor 6: Coalition Alignment
  let coalitionScore = 50
  if (totalStances > 0) {
    coalitionScore = Math.round((forStances / totalStances) * 100)
  }
  const coalitionFactor: SignalFactor = {
    key: 'coalitions',
    label: 'Coalition Alignment',
    score: coalitionScore,
    direction: totalStances > 0 ? directionFromScore(coalitionScore) : 'neutral',
    description:
      totalStances === 0
        ? 'No coalitions have staked a position.'
        : `${forStances} coalition${forStances !== 1 ? 's' : ''} FOR vs ${againstStances} AGAINST.`,
    weight: 1.0,
  }

  // Factor 7: Debate Activity
  const debateCount = activeDebates ?? 0
  const debateScore = debateCount >= 3 ? 75 : debateCount >= 1 ? 62 : 50
  const debateDirection = debateCount >= 1 ? (price >= 50 ? 'bullish' : 'bearish') : 'neutral'
  const debateFactor: SignalFactor = {
    key: 'debates',
    label: 'Debate Signal',
    score: debateScore,
    direction: debateDirection,
    description:
      debateCount === 0
        ? 'No active debates on this market.'
        : `${debateCount} active debate${debateCount !== 1 ? 's' : ''} in progress.`,
    weight: 0.7,
  }

  const factors: SignalFactor[] = [
    consensusFactor,
    momentumFactor,
    volumeFactor,
    argumentFactor,
    stabilityFactor,
    coalitionFactor,
    debateFactor,
  ]

  // ── Composite signal ──────────────────────────────────────────────────────
  // Weighted average of factor scores (each 0-100, 50 = neutral)
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const composite = Math.round(
    factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight,
  )

  const compositeDirection = directionFromScore(composite)
  const label = compositeLabel(composite)

  // Confidence: based on snapshot count and days active
  const confidence: 'low' | 'medium' | 'high' =
    snapshotCount >= 30 && daysActive >= 14
      ? 'high'
      : snapshotCount >= 10 || daysActive >= 7
      ? 'medium'
      : 'low'

  // Key driver: highest-weighted non-neutral factor
  const nonNeutral = factors
    .filter((f) => f.direction !== 'neutral')
    .sort((a, b) => b.weight - a.weight)
  const keyDriver = nonNeutral[0]?.label ?? null

  // ── 30-day signal history from snapshots ─────────────────────────────────
  // Group snapshots by date and compute a daily composite price signal
  type DayAccumulator = { priceSum: number; count: number }
  const byDate = new Map<string, DayAccumulator>()
  for (const snap of snaps) {
    const day = (snap.recorded_at as string).slice(0, 10)
    const existing = byDate.get(day) ?? { priceSum: 0, count: 0 }
    existing.priceSum += snap.price_cents as number
    existing.count++
    byDate.set(day, existing)
  }

  const signalHistory: SignalDay[] = Array.from(byDate.entries())
    .map(([date, acc]) => {
      const dayPrice = Math.round(acc.priceSum / acc.count)
      return { date, composite: dayPrice, price: dayPrice }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary: string[] = []

  if (compositeDirection === 'bullish') {
    summary.push(`${label} signal at ${composite}/100 — majority of factors point FOR.`)
  } else if (compositeDirection === 'bearish') {
    summary.push(`${label} signal at ${composite}/100 — majority of factors point AGAINST.`)
  } else {
    summary.push(`Neutral signal at ${composite}/100 — market is evenly contested.`)
  }

  if (keyDriver) {
    summary.push(
      `Strongest driver: ${keyDriver} (${nonNeutral[0].direction === 'bullish' ? 'FOR' : 'AGAINST'}).`,
    )
  }

  if (confidence === 'low') {
    summary.push('Low confidence — market is new and lacks sufficient price history.')
  } else if (confidence === 'high') {
    summary.push(`High confidence — based on ${snapshotCount} price snapshots over ${daysActive} days.`)
  }

  if (volatilityScore >= 50) {
    summary.push('Elevated volatility — consensus can shift quickly. Monitor closely.')
  }

  const result: MarketSignal = {
    id: topic.id as string,
    statement: topic.statement as string,
    category: (topic.category as string | null) ?? null,
    status: topic.status as string,
    price,
    volume,
    composite_score: composite,
    composite_direction: compositeDirection,
    composite_label: label,
    confidence,
    factors,
    signal_history: signalHistory,
    key_driver: keyDriver,
    summary,
    snapshot_count: snapshotCount,
  }

  return NextResponse.json(result)
}
