import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PriceBucket {
  range: string   // e.g. "0-10", "10-20"
  low: number
  high: number
  count: number
}

export interface VelocityPoint {
  date: string     // YYYY-MM-DD
  votes: number
  price: number
}

export interface MarketAnalysis {
  id: string
  statement: string
  category: string | null
  status: string
  price: number

  // Price statistics
  price_high: number
  price_low: number
  price_open: number
  price_mean: number
  price_median: number
  price_std_dev: number
  price_range: number

  // Trend
  trend_direction: 'bullish' | 'bearish' | 'neutral'
  trend_strength: number    // 0-100
  momentum_7d: number | null
  momentum_30d: number | null

  // Volume
  total_votes: number
  daily_avg_votes: number
  peak_daily_votes: number
  days_active: number

  // Market signals
  support_level: number | null
  resistance_level: number | null
  is_overbought: boolean   // price > 80
  is_oversold: boolean     // price < 20
  volatility_score: number  // 0-100, std_dev normalised

  // Sentiment (from arguments)
  for_argument_count: number
  against_argument_count: number
  top_for_score: number
  top_against_score: number

  // Distribution
  price_distribution: PriceBucket[]

  // Voting velocity (last 30 days, one row per day that had activity)
  velocity: VelocityPoint[]

  // Category context
  category_avg_price: number | null
  category_market_count: number | null

  // Snapshot count
  snapshot_count: number
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 50
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

function detectSupportResistance(prices: number[]): { support: number | null; resistance: number | null } {
  if (prices.length < 5) return { support: null, resistance: null }
  // Use the last 30% of price points for recent context
  const recent = prices.slice(-Math.ceil(prices.length * 0.3))
  const support = recent.reduce((a, b) => Math.min(a, b))
  const resistance = recent.reduce((a, b) => Math.max(a, b))
  // Only report if they're meaningfully different from current price
  const current = prices[prices.length - 1]
  return {
    support: Math.abs(current - support) > 3 ? Math.round(support) : null,
    resistance: Math.abs(resistance - current) > 3 ? Math.round(resistance) : null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', id)
    .single()

  if (error || !topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── 2. Price history ──────────────────────────────────────────────────────
  const { data: rawHistory } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(1000)

  const history = rawHistory ?? []
  const prices = history.map((h) => h.price)

  // ── 3. Price statistics ───────────────────────────────────────────────────
  const sorted = [...prices].sort((a, b) => a - b)
  const price = topic.blue_pct ?? 50
  const priceHigh = sorted.length > 0 ? sorted[sorted.length - 1] : price
  const priceLow = sorted.length > 0 ? sorted[0] : price
  const priceOpen = sorted.length > 0 ? prices[0] : price
  const priceMean = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : price
  const priceMedian = median(sorted)
  const priceStdDev = stdDev(prices, priceMean)
  const volatilityScore = Math.min(100, Math.round((priceStdDev / 25) * 100))

  // ── 4. Trend ──────────────────────────────────────────────────────────────
  const now = Date.now()
  const ms7d = 7 * 24 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000

  const price7dAgo = history.findLast((h) => new Date(h.recorded_at).getTime() < now - ms7d)?.price ?? null
  const price30dAgo = history.findLast((h) => new Date(h.recorded_at).getTime() < now - ms30d)?.price ?? null
  const momentum7d = price7dAgo !== null ? Math.round((price - price7dAgo) * 10) / 10 : null
  const momentum30d = price30dAgo !== null ? Math.round((price - price30dAgo) * 10) / 10 : null

  let trendDirection: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  let trendStrength = 0
  if (momentum7d !== null) {
    if (momentum7d > 3) { trendDirection = 'bullish'; trendStrength = Math.min(100, Math.round(momentum7d * 5)) }
    else if (momentum7d < -3) { trendDirection = 'bearish'; trendStrength = Math.min(100, Math.round(Math.abs(momentum7d) * 5)) }
  }

  // ── 5. Volume / velocity ──────────────────────────────────────────────────
  const createdAt = new Date(topic.created_at ?? Date.now())
  const daysActive = Math.max(1, Math.ceil((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)))
  const totalVotes = topic.total_votes ?? 0
  const dailyAvgVotes = Math.round(totalVotes / daysActive)

  // Build daily velocity from price history (use volume diff as proxy)
  const dailyMap: Record<string, { votes: number; price: number }> = {}
  let prevVolume = 0
  for (const snap of history) {
    const day = snap.recorded_at.slice(0, 10)
    const dayVotes = Math.max(0, snap.volume - prevVolume)
    if (!dailyMap[day]) dailyMap[day] = { votes: 0, price: snap.price }
    dailyMap[day].votes += dayVotes
    dailyMap[day].price = snap.price
    prevVolume = snap.volume
  }
  const cutoff30d = new Date(Date.now() - ms30d).toISOString().slice(0, 10)
  const velocity: VelocityPoint[] = Object.entries(dailyMap)
    .filter(([day]) => day >= cutoff30d)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, votes: v.votes, price: v.price }))
  const peakDailyVotes = velocity.length > 0
    ? velocity.reduce((max, v) => Math.max(max, v.votes), 0)
    : totalVotes

  // ── 6. Support / resistance ───────────────────────────────────────────────
  const { support: supportLevel, resistance: resistanceLevel } = detectSupportResistance(prices)

  // ── 7. Price distribution (10-bucket histogram) ───────────────────────────
  const buckets: PriceBucket[] = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}–${(i + 1) * 10}`,
    low: i * 10,
    high: (i + 1) * 10,
    count: 0,
  }))
  for (const p of prices) {
    const idx = Math.min(9, Math.floor(p / 10))
    buckets[idx].count++
  }

  // ── 8. Arguments ─────────────────────────────────────────────────────────
  const { data: forArgs } = await supabase
    .from('arguments')
    .select('upvote_count')
    .eq('topic_id', id)
    .eq('side', 'for')
    .order('upvote_count', { ascending: false })
    .limit(20)

  const { data: againstArgs } = await supabase
    .from('arguments')
    .select('upvote_count')
    .eq('topic_id', id)
    .eq('side', 'against')
    .order('upvote_count', { ascending: false })
    .limit(20)

  const topForScore = forArgs?.[0]?.upvote_count ?? 0
  const topAgainstScore = againstArgs?.[0]?.upvote_count ?? 0

  // ── 9. Category context ───────────────────────────────────────────────────
  let categoryAvgPrice: number | null = null
  let categoryMarketCount: number | null = null
  if (topic.category) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('blue_pct')
      .eq('category', topic.category)
      .in('status', ['active', 'voting'])
      .neq('id', id)
      .limit(100)

    if (catTopics && catTopics.length > 0) {
      categoryMarketCount = catTopics.length
      categoryAvgPrice = Math.round(
        catTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / catTopics.length
      )
    }
  }

  const analysis: MarketAnalysis = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    price,

    price_high: Math.round(priceHigh),
    price_low: Math.round(priceLow),
    price_open: Math.round(priceOpen),
    price_mean: Math.round(priceMean * 10) / 10,
    price_median: Math.round(priceMedian * 10) / 10,
    price_std_dev: Math.round(priceStdDev * 10) / 10,
    price_range: Math.round(priceHigh - priceLow),

    trend_direction: trendDirection,
    trend_strength: trendStrength,
    momentum_7d: momentum7d,
    momentum_30d: momentum30d,

    total_votes: totalVotes,
    daily_avg_votes: dailyAvgVotes,
    peak_daily_votes: peakDailyVotes,
    days_active: daysActive,

    support_level: supportLevel,
    resistance_level: resistanceLevel,
    is_overbought: price > 80,
    is_oversold: price < 20,
    volatility_score: volatilityScore,

    for_argument_count: forArgs?.length ?? 0,
    against_argument_count: againstArgs?.length ?? 0,
    top_for_score: topForScore,
    top_against_score: topAgainstScore,

    price_distribution: buckets,
    velocity,

    category_avg_price: categoryAvgPrice,
    category_market_count: categoryMarketCount,

    snapshot_count: history.length,
  }

  return NextResponse.json(analysis)
}
