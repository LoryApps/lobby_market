import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConsensusMarket {
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  // Aggregated forecast data
  forecast_count: number
  avg_target: number
  avg_confidence: number
  // Crowd direction breakdown
  bullish_count: number
  bearish_count: number
  neutral_count: number
  // Divergence = crowd consensus vs. current price
  divergence: number // positive = crowd thinks underpriced
  // Most common horizon
  top_horizon: string
  // Crowd sentiment label
  crowd_direction: 'bullish' | 'bearish' | 'neutral' | 'mixed'
}

export interface ConsensusStats {
  total_forecasters: number
  total_markets_with_forecasts: number
  avg_bullish_pct: number
  markets_underpriced: number
  markets_overpriced: number
  avg_divergence: number
}

export interface ConsensusResponse {
  markets: ConsensusMarket[]
  stats: ConsensusStats
  sort: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') || 'forecasters'
  const category = searchParams.get('category') || null

  // Fetch all forecasts with topic data
  let forecastQuery = supabase
    .from('exchange_forecasts')
    .select(`
      topic_id,
      target_price,
      direction,
      confidence,
      horizon,
      topics!inner (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .in('topics.status', ['active', 'voting'])
    .limit(5000)

  if (category) {
    forecastQuery = forecastQuery.eq('topics.category', category)
  }

  const { data: forecasts, error } = await forecastQuery

  if (error || !forecasts) {
    return NextResponse.json({ markets: [], stats: null, sort }, { status: 200 })
  }

  // Group forecasts by topic
  const byTopic = new Map<
    string,
    {
      topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number }
      forecasts: Array<{ target_price: number; direction: string; confidence: number; horizon: string }>
    }
  >()

  for (const f of forecasts) {
    const topic = f.topics as unknown as {
      id: string; statement: string; category: string | null; status: string; blue_pct: number
    }
    if (!topic) continue
    if (!byTopic.has(f.topic_id)) {
      byTopic.set(f.topic_id, { topic, forecasts: [] })
    }
    byTopic.get(f.topic_id)!.forecasts.push({
      target_price: f.target_price,
      direction: f.direction,
      confidence: f.confidence,
      horizon: f.horizon,
    })
  }

  // Aggregate per topic
  const markets: ConsensusMarket[] = []

  for (const [topicId, { topic, forecasts: tf }] of byTopic.entries()) {
    const n = tf.length
    if (n === 0) continue

    const avgTarget = tf.reduce((s, f) => s + f.target_price, 0) / n
    const avgConf = tf.reduce((s, f) => s + f.confidence, 0) / n
    const bullish = tf.filter((f) => f.direction === 'bullish').length
    const bearish = tf.filter((f) => f.direction === 'bearish').length
    const neutral = tf.filter((f) => f.direction === 'neutral').length

    // Most common horizon
    const horizonCount: Record<string, number> = {}
    for (const f of tf) horizonCount[f.horizon] = (horizonCount[f.horizon] ?? 0) + 1
    const topHorizon = Object.entries(horizonCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '30d'

    const currentPrice = Math.round(topic.blue_pct ?? 50)
    const divergence = Math.round(avgTarget - currentPrice)

    // Crowd direction
    let crowdDirection: ConsensusMarket['crowd_direction']
    const bullPct = bullish / n
    const bearPct = bearish / n
    if (bullPct >= 0.6) crowdDirection = 'bullish'
    else if (bearPct >= 0.6) crowdDirection = 'bearish'
    else if (Math.abs(bullPct - bearPct) < 0.2) crowdDirection = 'mixed'
    else crowdDirection = 'neutral'

    markets.push({
      topic_id: topicId,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_price: currentPrice,
      forecast_count: n,
      avg_target: Math.round(avgTarget),
      avg_confidence: Math.round(avgConf * 10) / 10,
      bullish_count: bullish,
      bearish_count: bearish,
      neutral_count: neutral,
      divergence,
      top_horizon: topHorizon,
      crowd_direction: crowdDirection,
    })
  }

  // Sort
  switch (sort) {
    case 'bullish':
      markets.sort((a, b) => b.bullish_count / b.forecast_count - a.bullish_count / a.forecast_count)
      break
    case 'bearish':
      markets.sort((a, b) => b.bearish_count / b.forecast_count - a.bearish_count / a.forecast_count)
      break
    case 'underpriced':
      markets.sort((a, b) => b.divergence - a.divergence)
      break
    case 'overpriced':
      markets.sort((a, b) => a.divergence - b.divergence)
      break
    case 'confidence':
      markets.sort((a, b) => b.avg_confidence - a.avg_confidence)
      break
    default:
      // forecasters
      markets.sort((a, b) => b.forecast_count - a.forecast_count)
  }

  // Limit to top 50
  const topMarkets = markets.slice(0, 50)

  // Platform-wide stats
  // We don't have user_id in the aggregated result, so use total forecasts / avg per market
  const totalForecasters = forecasts.length // rough proxy
  const underpriced = markets.filter((m) => m.divergence > 3).length
  const overpriced = markets.filter((m) => m.divergence < -3).length
  const avgDiv = markets.length > 0
    ? markets.reduce((s, m) => s + m.divergence, 0) / markets.length
    : 0
  const bullishPcts = markets.map((m) => (m.bullish_count / m.forecast_count) * 100)
  const avgBullishPct = bullishPcts.length > 0
    ? bullishPcts.reduce((s, v) => s + v, 0) / bullishPcts.length
    : 0

  const stats: ConsensusStats = {
    total_forecasters: totalForecasters,
    total_markets_with_forecasts: markets.length,
    avg_bullish_pct: Math.round(avgBullishPct),
    markets_underpriced: underpriced,
    markets_overpriced: overpriced,
    avg_divergence: Math.round(avgDiv),
  }

  return NextResponse.json({ markets: topMarkets, stats, sort })
}
