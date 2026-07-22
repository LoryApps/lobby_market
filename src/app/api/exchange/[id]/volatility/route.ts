import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VolatilityPeriod {
  label: string
  days: number
  stddev: number
  range: number
  high: number
  low: number
  snapshots: number
  choppiness: number
  avg_daily_move: number
}

export interface VolatilityPriceBar {
  date: string
  price: number
  volume: number
  daily_vol: number
}

export interface MarketVolatilityResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number

  volatility_score: number
  volatility_level: 'very_low' | 'low' | 'moderate' | 'high' | 'extreme'
  volatility_label: string

  periods: VolatilityPeriod[]
  price_history: VolatilityPriceBar[]

  overall_stddev: number
  overall_range: number
  overall_high: number
  overall_low: number
  choppiness_score: number
  trend_consistency: number

  category_avg_stddev: number | null
  category_percentile: number | null

  max_drawdown: number
  max_rally: number
  reversal_count: number

  snapshot_count: number
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function choppiness(prices: number[]): number {
  if (prices.length < 3) return 0
  let reversals = 0
  for (let i = 1; i < prices.length - 1; i++) {
    const prev = prices[i - 1]
    const cur  = prices[i]
    const next = prices[i + 1]
    if ((cur > prev && cur > next) || (cur < prev && cur < next)) reversals++
  }
  return Math.round((reversals / (prices.length - 2)) * 100)
}

function trendConsistency(prices: number[]): number {
  if (prices.length < 3) return 100
  let sameDir = 0
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] === prices[i - 1]) { sameDir++; continue }
    if (i === 1) { sameDir++; continue }
    const prevDir = prices[i - 1] > prices[i - 2] ? 1 : -1
    const curDir  = prices[i] > prices[i - 1] ? 1 : -1
    if (prevDir === curDir) sameDir++
  }
  return Math.round((sameDir / (prices.length - 1)) * 100)
}

function maxDrawdown(prices: number[]): number {
  let peak = -Infinity
  let maxDD = 0
  for (const p of prices) {
    if (p > peak) peak = p
    const dd = peak - p
    if (dd > maxDD) maxDD = dd
  }
  return Math.round(maxDD * 10) / 10
}

function maxRally(prices: number[]): number {
  let trough = Infinity
  let maxR = 0
  for (const p of prices) {
    if (p < trough) trough = p
    const r = p - trough
    if (r > maxR) maxR = r
  }
  return Math.round(maxR * 10) / 10
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function volScore(sd: number): number {
  // Maps stddev (0-50 range) to 0-100 score
  if (sd <= 1)  return clamp(sd * 5, 0, 100)
  if (sd <= 5)  return clamp(5 + (sd - 1) * 8.75, 0, 100)
  if (sd <= 10) return clamp(40 + (sd - 5) * 6, 0, 100)
  if (sd <= 20) return clamp(70 + (sd - 10) * 2.5, 0, 100)
  return 95
}

function volLevel(score: number): MarketVolatilityResponse['volatility_level'] {
  if (score <= 20) return 'very_low'
  if (score <= 40) return 'low'
  if (score <= 60) return 'moderate'
  if (score <= 80) return 'high'
  return 'extreme'
}

function volLabel(level: MarketVolatilityResponse['volatility_level']): string {
  switch (level) {
    case 'very_low': return 'Very Low Volatility'
    case 'low':      return 'Low Volatility'
    case 'moderate': return 'Moderate Volatility'
    case 'high':     return 'High Volatility'
    case 'extreme':  return 'Extreme Volatility'
  }
}

function buildPeriod(prices: number[], days: number, label: string): VolatilityPeriod {
  if (prices.length === 0) {
    return { label, days, stddev: 0, range: 0, high: 50, low: 50, snapshots: 0, choppiness: 0, avg_daily_move: 0 }
  }
  const high = Math.max(...prices)
  const low  = Math.min(...prices)
  const sd   = stddev(prices)
  const ch   = choppiness(prices)
  const diffs = prices.slice(1).map((p, i) => Math.abs(p - prices[i]))
  const avgMove = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0
  return {
    label,
    days,
    stddev:        Math.round(sd * 10) / 10,
    range:         Math.round((high - low) * 10) / 10,
    high:          Math.round(high),
    low:           Math.round(low),
    snapshots:     prices.length,
    choppiness:    ch,
    avg_daily_move: Math.round(avgMove * 10) / 10,
  }
}

// ─── GET /api/exchange/[id]/volatility ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const price  = Math.round(topic.blue_pct ?? 50)
  const volume = (topic.total_votes ?? 0) as number

  // ── Fetch price history ────────────────────────────────────────────────────
  const { data: histRows } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(500)

  const history = histRows ?? []

  const now = Date.now()
  const cutoff7d  = now - 7  * 86_400_000
  const cutoff14d = now - 14 * 86_400_000
  const cutoff30d = now - 30 * 86_400_000

  const prices7d  = history.filter(r => new Date(r.recorded_at).getTime() >= cutoff7d).map(r => r.price as number)
  const prices14d = history.filter(r => new Date(r.recorded_at).getTime() >= cutoff14d).map(r => r.price as number)
  const prices30d = history.filter(r => new Date(r.recorded_at).getTime() >= cutoff30d).map(r => r.price as number)
  const allPrices = history.map(r => r.price as number)

  // Always include current price so we have at least one data point
  if (allPrices.length === 0) allPrices.push(price)
  if (prices7d.length === 0)  prices7d.push(price)
  if (prices14d.length === 0) prices14d.push(price)
  if (prices30d.length === 0) prices30d.push(price)

  const periods: VolatilityPeriod[] = [
    buildPeriod(prices7d,  7,  '7d'),
    buildPeriod(prices14d, 14, '14d'),
    buildPeriod(prices30d, 30, '30d'),
  ]

  const overallSd   = stddev(allPrices)
  const overallHigh = Math.max(...allPrices, price)
  const overallLow  = Math.min(...allPrices, price)

  const score   = volScore(overallSd)
  const level   = volLevel(score)
  const label   = volLabel(level)

  const choppScore = choppiness(allPrices)
  const trendCons  = trendConsistency(allPrices)
  const maxDD      = maxDrawdown([...allPrices, price])
  const maxR       = maxRally([...allPrices, price])

  let reversals = 0
  for (let i = 1; i < allPrices.length - 1; i++) {
    const prev = allPrices[i - 1]
    const cur  = allPrices[i]
    const next = allPrices[i + 1]
    if ((cur > prev && cur > next) || (cur < prev && cur < next)) reversals++
  }

  // ── Price history for chart (last 60 points) ──────────────────────────────
  const chartPoints = history.slice(-60)
  const priceHistory: VolatilityPriceBar[] = chartPoints.map((r, i) => {
    const prevPrice = i === 0 ? (r.price as number) : (chartPoints[i - 1].price as number)
    return {
      date:       r.recorded_at as string,
      price:      Math.round(r.price as number),
      volume:     r.volume as number,
      daily_vol:  Math.round(Math.abs((r.price as number) - prevPrice) * 10) / 10,
    }
  })

  // ── Category comparison ────────────────────────────────────────────────────
  let categoryAvgStddev: number | null = null
  let categoryPercentile: number | null = null

  if (topic.category) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('id')
      .eq('category', topic.category)
      .neq('id', id)
      .limit(30)

    if (catTopics && catTopics.length > 0) {
      const catIds = catTopics.map(t => t.id as string)
      const { data: catHistory } = await supabase
        .from('topic_price_history')
        .select('topic_id, price')
        .in('topic_id', catIds)
        .gte('recorded_at', new Date(cutoff30d).toISOString())
        .limit(1000)

      if (catHistory && catHistory.length > 0) {
        const byTopic = new Map<string, number[]>()
        for (const row of catHistory) {
          const tid = row.topic_id as string
          if (!byTopic.has(tid)) byTopic.set(tid, [])
          byTopic.get(tid)!.push(row.price as number)
        }
        const catSDs = Array.from(byTopic.values()).map(p => stddev(p))
        if (catSDs.length > 0) {
          categoryAvgStddev = Math.round(
            (catSDs.reduce((a, b) => a + b, 0) / catSDs.length) * 10,
          ) / 10
          const below = catSDs.filter(sd => sd < overallSd).length
          categoryPercentile = Math.round((below / catSDs.length) * 100)
        }
      }
    }
  }

  const response: MarketVolatilityResponse = {
    topic_id:          topic.id,
    statement:         topic.statement,
    category:          topic.category ?? null,
    status:            topic.status,
    price,
    volume,

    volatility_score:  Math.round(score),
    volatility_level:  level,
    volatility_label:  label,

    periods,
    price_history:     priceHistory,

    overall_stddev:    Math.round(overallSd * 10) / 10,
    overall_range:     Math.round((overallHigh - overallLow) * 10) / 10,
    overall_high:      Math.round(overallHigh),
    overall_low:       Math.round(overallLow),
    choppiness_score:  choppScore,
    trend_consistency: trendCons,

    category_avg_stddev:  categoryAvgStddev,
    category_percentile:  categoryPercentile,

    max_drawdown:   maxDD,
    max_rally:      maxR,
    reversal_count: reversals,

    snapshot_count: history.length,
    as_of:         new Date().toISOString(),
  }

  return NextResponse.json(response)
}
