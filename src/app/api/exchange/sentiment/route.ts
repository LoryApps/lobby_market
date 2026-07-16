import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectorSentiment {
  category: string
  market_count: number
  avg_price: number
  bullish_count: number
  bearish_count: number
  neutral_count: number
  total_volume: number
  sentiment: 'bullish' | 'bearish' | 'neutral'
  sentiment_strength: 'strong' | 'moderate' | 'weak'
  delta_24h: number | null
}

export interface SentimentMover {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  delta_24h: number
  volume: number
  direction: 'up' | 'down'
}

export interface SentimentBand {
  label: string
  range: string
  count: number
  pct: number
  markets: Array<{ id: string; statement: string; price: number; volume: number; category: string | null }>
}

export interface SentimentResponse {
  overall_score: number
  overall_sentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish'
  breadth: {
    bullish_pct: number
    neutral_pct: number
    bearish_pct: number
    total_markets: number
    advance_decline_ratio: number
  }
  sectors: SectorSentiment[]
  top_movers_up: SentimentMover[]
  top_movers_down: SentimentMover[]
  bands: SentimentBand[]
  extreme_consensus: Array<{ id: string; statement: string; price: number; volume: number; category: string | null }>
  deeply_contested: Array<{ id: string; statement: string; price: number; volume: number; category: string | null }>
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifySentiment(price: number): 'bullish' | 'bearish' | 'neutral' {
  if (price >= 55) return 'bullish'
  if (price <= 45) return 'bearish'
  return 'neutral'
}

function sentimentStrength(price: number): 'strong' | 'moderate' | 'weak' {
  const distance = Math.abs(price - 50)
  if (distance >= 25) return 'strong'
  if (distance >= 12) return 'moderate'
  return 'weak'
}

function overallSentiment(score: number): SentimentResponse['overall_sentiment'] {
  if (score >= 65) return 'very_bullish'
  if (score >= 55) return 'bullish'
  if (score <= 35) return 'very_bearish'
  if (score <= 45) return 'bearish'
  return 'neutral'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch active markets (active + voting status, min 3 votes)
    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 3)
      .order('total_votes', { ascending: false })
      .limit(600)

    if (error || !topics || topics.length === 0) {
      return NextResponse.json(
        {
          overall_score: 50,
          overall_sentiment: 'neutral',
          breadth: { bullish_pct: 33, neutral_pct: 34, bearish_pct: 33, total_markets: 0, advance_decline_ratio: 1 },
          sectors: [],
          top_movers_up: [],
          top_movers_down: [],
          bands: [],
          extreme_consensus: [],
          deeply_contested: [],
          as_of: new Date().toISOString(),
        } satisfies SentimentResponse,
        { status: 200 },
      )
    }

    // Fetch 24h history for delta computation
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const topicIds = topics.map((t) => t.id as string)

    const { data: history } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, recorded_at')
      .in('topic_id', topicIds)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })

    // Build earliest-price-in-window map for delta
    const earliestPrice: Record<string, number> = {}
    for (const row of history ?? []) {
      const id = row.topic_id as string
      if (!(id in earliestPrice)) {
        earliestPrice[id] = row.price as number
      }
    }

    // ── Overall score ─────────────────────────────────────────────────────────
    let totalVolumeWeight = 0
    let weightedPriceSum = 0
    let bullishCount = 0
    let bearishCount = 0
    let neutralCount = 0

    for (const t of topics) {
      const price = (t.blue_pct as number) ?? 50
      const vol = Math.max(t.total_votes as number, 1)
      weightedPriceSum += price * vol
      totalVolumeWeight += vol

      const s = classifySentiment(price)
      if (s === 'bullish') bullishCount++
      else if (s === 'bearish') bearishCount++
      else neutralCount++
    }

    const totalMarkets = topics.length
    const overallScore = totalVolumeWeight > 0 ? weightedPriceSum / totalVolumeWeight : 50

    // ── Sectors ───────────────────────────────────────────────────────────────
    const sectorMap: Record<string, { markets: typeof topics; prices: number[]; volumes: number[] }> = {}
    for (const t of topics) {
      const cat = (t.category as string) ?? 'Uncategorised'
      if (!sectorMap[cat]) sectorMap[cat] = { markets: [], prices: [], volumes: [] }
      sectorMap[cat].markets.push(t)
      sectorMap[cat].prices.push((t.blue_pct as number) ?? 50)
      sectorMap[cat].volumes.push(t.total_votes as number)
    }

    const sectors: SectorSentiment[] = Object.entries(sectorMap)
      .filter(([, v]) => v.markets.length >= 2)
      .map(([cat, v]) => {
        let volSum = 0
        let wPriceSum = 0
        let b = 0, bear = 0, n = 0

        for (let i = 0; i < v.prices.length; i++) {
          const p = v.prices[i]
          const vol = Math.max(v.volumes[i], 1)
          wPriceSum += p * vol
          volSum += vol
          const s = classifySentiment(p)
          if (s === 'bullish') b++
          else if (s === 'bearish') bear++
          else n++
        }

        const avgPrice = volSum > 0 ? wPriceSum / volSum : 50

        // 24h delta for sector: avg of individual deltas
        const deltas = v.markets
          .map((m) => {
            const ep = earliestPrice[m.id as string]
            return ep !== undefined ? ((m.blue_pct as number) ?? 50) - ep : null
          })
          .filter((d): d is number => d !== null)
        const delta24h = deltas.length > 0 ? deltas.reduce((a, c) => a + c, 0) / deltas.length : null

        return {
          category: cat,
          market_count: v.markets.length,
          avg_price: Math.round(avgPrice * 10) / 10,
          bullish_count: b,
          bearish_count: bear,
          neutral_count: n,
          total_volume: volSum,
          sentiment: classifySentiment(avgPrice),
          sentiment_strength: sentimentStrength(avgPrice),
          delta_24h: delta24h !== null ? Math.round(delta24h * 10) / 10 : null,
        }
      })
      .sort((a, b) => b.total_volume - a.total_volume)

    // ── Top movers ────────────────────────────────────────────────────────────
    interface Mover {
      topic: typeof topics[0]
      delta: number
    }

    const moversRaw: Mover[] = topics
      .filter((t) => t.id in earliestPrice)
      .map((t) => ({
        topic: t,
        delta: ((t.blue_pct as number) ?? 50) - earliestPrice[t.id as string],
      }))
      .filter((m) => Math.abs(m.delta) >= 1)

    moversRaw.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    const topMoversUp: SentimentMover[] = moversRaw
      .filter((m) => m.delta > 0)
      .slice(0, 6)
      .map((m) => ({
        id: m.topic.id as string,
        statement: m.topic.statement as string,
        category: m.topic.category as string | null,
        status: m.topic.status as string,
        price: (m.topic.blue_pct as number) ?? 50,
        delta_24h: Math.round(m.delta * 10) / 10,
        volume: m.topic.total_votes as number,
        direction: 'up',
      }))

    const topMoversDown: SentimentMover[] = moversRaw
      .filter((m) => m.delta < 0)
      .slice(0, 6)
      .map((m) => ({
        id: m.topic.id as string,
        statement: m.topic.statement as string,
        category: m.topic.category as string | null,
        status: m.topic.status as string,
        price: (m.topic.blue_pct as number) ?? 50,
        delta_24h: Math.round(m.delta * 10) / 10,
        volume: m.topic.total_votes as number,
        direction: 'down',
      }))

    // ── Sentiment bands ───────────────────────────────────────────────────────
    const BANDS = [
      { label: 'Extreme FOR', range: '80–100¢', min: 80, max: 100 },
      { label: 'Strong FOR', range: '65–79¢', min: 65, max: 79.9 },
      { label: 'Moderate FOR', range: '55–64¢', min: 55, max: 64.9 },
      { label: 'Contested', range: '45–54¢', min: 45, max: 54.9 },
      { label: 'Moderate AGAINST', range: '35–44¢', min: 35, max: 44.9 },
      { label: 'Strong AGAINST', range: '20–34¢', min: 20, max: 34.9 },
      { label: 'Extreme AGAINST', range: '0–19¢', min: 0, max: 19.9 },
    ]

    const bands: SentimentBand[] = BANDS.map((band) => {
      const matching = topics.filter((t) => {
        const p = (t.blue_pct as number) ?? 50
        return p >= band.min && p <= band.max
      })
      return {
        label: band.label,
        range: band.range,
        count: matching.length,
        pct: Math.round((matching.length / totalMarkets) * 1000) / 10,
        markets: matching.slice(0, 5).map((t) => ({
          id: t.id as string,
          statement: t.statement as string,
          price: (t.blue_pct as number) ?? 50,
          volume: t.total_votes as number,
          category: t.category as string | null,
        })),
      }
    })

    // ── Extreme consensus ─────────────────────────────────────────────────────
    const extremeConsensus = topics
      .filter((t) => (t.blue_pct as number) >= 80)
      .slice(0, 8)
      .map((t) => ({
        id: t.id as string,
        statement: t.statement as string,
        price: (t.blue_pct as number) ?? 50,
        volume: t.total_votes as number,
        category: t.category as string | null,
      }))

    // ── Deeply contested ──────────────────────────────────────────────────────
    const deeplyContested = topics
      .filter((t) => {
        const p = (t.blue_pct as number) ?? 50
        return p >= 47 && p <= 53 && (t.total_votes as number) >= 10
      })
      .sort((a, b) => (b.total_votes as number) - (a.total_votes as number))
      .slice(0, 8)
      .map((t) => ({
        id: t.id as string,
        statement: t.statement as string,
        price: (t.blue_pct as number) ?? 50,
        volume: t.total_votes as number,
        category: t.category as string | null,
      }))

    const response: SentimentResponse = {
      overall_score: Math.round(overallScore * 10) / 10,
      overall_sentiment: overallSentiment(overallScore),
      breadth: {
        bullish_pct: Math.round((bullishCount / totalMarkets) * 1000) / 10,
        neutral_pct: Math.round((neutralCount / totalMarkets) * 1000) / 10,
        bearish_pct: Math.round((bearishCount / totalMarkets) * 1000) / 10,
        total_markets: totalMarkets,
        advance_decline_ratio:
          bearishCount > 0 ? Math.round((bullishCount / bearishCount) * 100) / 100 : bullishCount,
      },
      sectors,
      top_movers_up: topMoversUp,
      top_movers_down: topMoversDown,
      bands,
      extreme_consensus: extremeConsensus,
      deeply_contested: deeplyContested,
      as_of: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[sentiment] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
