import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VolatileMarket {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  volume: number
  stddev: number
  price_range: number
  high_price: number
  low_price: number
  snapshot_count: number
  choppiness: number   // 0–100: how often price reverses direction
  trend: 'rising' | 'falling' | 'sideways'
  trend_strength: number  // magnitude of net trend (positive = up)
  history: number[]       // price values for sparkline (max 20 pts)
}

export interface CategoryVolatility {
  category: string
  avg_stddev: number
  max_stddev: number
  market_count: number
  active_count: number
  vol_rank: number   // 1 = most volatile category
}

export interface VolatilityResponse {
  most_volatile: VolatileMarket[]
  most_stable: VolatileMarket[]
  by_category: CategoryVolatility[]
  market_volatility_index: number   // market-wide weighted average stddev
  fear_gauge: 'extreme_volatility' | 'high' | 'moderate' | 'low' | 'stable'
  timeframe_days: number
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
    const wasRising = cur > prev
    const nowFalling = next < cur
    const wasFalling = cur < prev
    const nowRising  = next > cur
    if ((wasRising && nowFalling) || (wasFalling && nowRising)) reversals++
  }
  return Math.round((reversals / (prices.length - 2)) * 100)
}

function trendDirection(
  prices: number[],
): { trend: VolatileMarket['trend']; trend_strength: number } {
  if (prices.length < 2) return { trend: 'sideways', trend_strength: 0 }
  const first = prices[0]
  const last  = prices[prices.length - 1]
  const net   = last - first
  if (Math.abs(net) < 2) return { trend: 'sideways', trend_strength: Math.abs(net) }
  return {
    trend: net > 0 ? 'rising' : 'falling',
    trend_strength: Math.abs(net),
  }
}

function downsampleHistory(prices: number[], maxPoints = 20): number[] {
  if (prices.length <= maxPoints) return prices
  const step = prices.length / maxPoints
  return Array.from({ length: maxPoints }, (_, i) => {
    const idx = Math.min(Math.round(i * step), prices.length - 1)
    return prices[idx]
  })
}

function fearGauge(index: number): VolatilityResponse['fear_gauge'] {
  if (index >= 15) return 'extreme_volatility'
  if (index >= 10) return 'high'
  if (index >= 5)  return 'moderate'
  if (index >= 2)  return 'low'
  return 'stable'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const url = new URL(req.url)
    const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get('days') ?? '30', 10)))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // 1. Fetch price history for the window
    const { data: history, error: hErr } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, recorded_at')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })

    if (hErr) throw hErr

    // 2. Fetch all active / voting / law topics (exclude proposed)
    const { data: topics, error: tErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(200)

    if (tErr) throw tErr

    // Group history by topic
    const histMap = new Map<string, number[]>()
    for (const row of history ?? []) {
      const arr = histMap.get(row.topic_id) ?? []
      arr.push(row.price)
      histMap.set(row.topic_id, arr)
    }

    // Compute stats for each topic
    const markets: VolatileMarket[] = []
    for (const t of topics ?? []) {
      const prices = histMap.get(t.id) ?? []
      if (prices.length < 2) continue   // need at least 2 snapshots

      const sd = stddev(prices)
      const hi = Math.max(...prices)
      const lo = Math.min(...prices)
      const { trend, trend_strength } = trendDirection(prices)
      const chop = choppiness(prices)

      markets.push({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        current_price: Math.round(t.blue_pct ?? 50),
        volume: t.total_votes ?? 0,
        stddev: Math.round(sd * 10) / 10,
        price_range: Math.round((hi - lo) * 10) / 10,
        high_price: Math.round(hi),
        low_price: Math.round(lo),
        snapshot_count: prices.length,
        choppiness: chop,
        trend,
        trend_strength: Math.round(trend_strength * 10) / 10,
        history: downsampleHistory(prices),
      })
    }

    if (markets.length === 0) {
      // Fallback: return topics sorted by price extremes when no history
      const fallback = (topics ?? []).slice(0, 20).map((t) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        current_price: Math.round(t.blue_pct ?? 50),
        volume: t.total_votes ?? 0,
        stddev: 0,
        price_range: 0,
        high_price: Math.round(t.blue_pct ?? 50),
        low_price: Math.round(t.blue_pct ?? 50),
        snapshot_count: 0,
        choppiness: 0,
        trend: 'sideways' as const,
        trend_strength: 0,
        history: [Math.round(t.blue_pct ?? 50)],
      }))
      return NextResponse.json({
        most_volatile: fallback.slice(0, 10),
        most_stable: fallback.slice(0, 10),
        by_category: [],
        market_volatility_index: 0,
        fear_gauge: 'stable' as const,
        timeframe_days: days,
        as_of: new Date().toISOString(),
      } satisfies VolatilityResponse)
    }

    // Sort and slice
    const byVolatility = [...markets].sort((a, b) => b.stddev - a.stddev)
    const most_volatile = byVolatility.slice(0, 12)
    const most_stable = [...markets]
      .filter((m) => m.snapshot_count >= 3)
      .sort((a, b) => a.stddev - b.stddev)
      .slice(0, 12)

    // Category aggregation
    const catMap = new Map<string, number[]>()
    for (const m of markets) {
      const cat = m.category ?? 'Other'
      const arr = catMap.get(cat) ?? []
      arr.push(m.stddev)
      catMap.set(cat, arr)
    }
    const categoriesSorted = [...catMap.entries()]
      .map(([category, sds]) => ({
        category,
        avg_stddev: Math.round((sds.reduce((a, b) => a + b, 0) / sds.length) * 10) / 10,
        max_stddev: Math.round(Math.max(...sds) * 10) / 10,
        market_count: markets.filter((m) => (m.category ?? 'Other') === category).length,
        active_count: markets.filter(
          (m) => (m.category ?? 'Other') === category && m.status === 'active',
        ).length,
        vol_rank: 0,
      }))
      .sort((a, b) => b.avg_stddev - a.avg_stddev)
      .map((c, i) => ({ ...c, vol_rank: i + 1 }))

    // Market-wide volatility index (volume-weighted average stddev)
    const totalVol = markets.reduce((s, m) => s + m.volume, 0) || 1
    const mvi = Math.round(
      (markets.reduce((s, m) => s + m.stddev * (m.volume / totalVol), 0) * 10) / 10,
    )

    return NextResponse.json({
      most_volatile,
      most_stable,
      by_category: categoriesSorted,
      market_volatility_index: mvi,
      fear_gauge: fearGauge(mvi),
      timeframe_days: days,
      as_of: new Date().toISOString(),
    } satisfies VolatilityResponse)
  } catch (err) {
    console.error('[exchange/volatility]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
