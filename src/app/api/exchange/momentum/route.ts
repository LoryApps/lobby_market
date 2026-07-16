import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MomentumMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number           // current blue_pct (0–100)
  volume: number          // total_votes
  delta_6h: number        // price change in last 6 hours (¢)
  delta_24h: number       // price change in last 24 hours (¢)
  acceleration: number    // (delta_6h / 6) / (delta_24h / 24) ratio — >1 means speeding up
  momentum_score: number  // 0–100 RSI-like composite score
  breakout_level: number | null  // threshold just crossed (33, 50, 67, 75) or null
  breakout_direction: 'up' | 'down' | null
  price_6h_ago: number | null
  price_24h_ago: number | null
  sparkline: number[]     // last 12 price points for mini chart
}

export type MomentumTab = 'surging' | 'falling' | 'breakouts' | 'stalling'

export interface MomentumResponse {
  surging: MomentumMarket[]
  falling: MomentumMarket[]
  breakouts: MomentumMarket[]
  stalling: MomentumMarket[]
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BREAKOUT_THRESHOLDS = [25, 33, 50, 67, 75]

function detectBreakout(
  currentPrice: number,
  price6h: number | null,
  price24h: number | null,
): { level: number; direction: 'up' | 'down' } | null {
  const refPrice = price6h ?? price24h
  if (refPrice === null) return null

  for (const threshold of BREAKOUT_THRESHOLDS) {
    const crossedUp = refPrice < threshold && currentPrice >= threshold
    const crossedDown = refPrice > threshold && currentPrice <= threshold
    if (crossedUp) return { level: threshold, direction: 'up' }
    if (crossedDown) return { level: threshold, direction: 'down' }
  }
  return null
}

function computeMomentumScore(
  delta6h: number,
  delta24h: number,
  acceleration: number,
  volume: number,
): number {
  // Start from 50 (neutral), adjust based on direction strength and acceleration
  let score = 50

  // Direction component: strong moves push toward 0 or 100
  const normalizedDelta = Math.min(Math.abs(delta24h) / 20, 1) * 40
  score += delta24h > 0 ? normalizedDelta : -normalizedDelta

  // Acceleration bonus/penalty
  if (Math.abs(delta6h) > 1) {
    const accelBonus = Math.min(Math.abs(acceleration - 1) * 15, 20)
    score += acceleration > 1 ? accelBonus : -accelBonus * 0.5
  }

  // Volume dampener (high volume = more reliable signal, low volume = noise risk)
  if (volume < 50) score = 50 + (score - 50) * 0.5

  return Math.min(100, Math.max(0, Math.round(score)))
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const now = Date.now()
    const since48h = new Date(now - 48 * 60 * 60 * 1000).toISOString()

    // Fetch 48h of price history, ordered by time
    const { data: history } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, volume, recorded_at')
      .gte('recorded_at', since48h)
      .order('recorded_at', { ascending: true })

    if (!history || history.length === 0) {
      return NextResponse.json({
        surging: [],
        falling: [],
        breakouts: [],
        stalling: [],
        as_of: new Date().toISOString(),
      } satisfies MomentumResponse)
    }

    // Group by topic
    const byTopic = new Map<
      string,
      { price: number; volume: number; recorded_at: string }[]
    >()
    for (const row of history) {
      if (!byTopic.has(row.topic_id)) byTopic.set(row.topic_id, [])
      byTopic.get(row.topic_id)!.push(row)
    }

    // Get current topic metadata
    const topicIds = Array.from(byTopic.keys())
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)
      .not('status', 'in', '("proposed","failed","law")')

    if (!topics || topics.length === 0) {
      return NextResponse.json({
        surging: [],
        falling: [],
        breakouts: [],
        stalling: [],
        as_of: new Date().toISOString(),
      } satisfies MomentumResponse)
    }

    const cutoff6h = now - 6 * 60 * 60 * 1000
    const cutoff24h = now - 24 * 60 * 60 * 1000

    const markets: MomentumMarket[] = []

    for (const topic of topics) {
      const rows = byTopic.get(topic.id)
      if (!rows || rows.length < 2) continue

      const currentPrice = topic.blue_pct ?? 50

      // Find closest snapshot at 6h and 24h ago
      let price6h: number | null = null
      let price24h: number | null = null
      let closestDiff6h = Infinity
      let closestDiff24h = Infinity

      for (const row of rows) {
        const ts = new Date(row.recorded_at).getTime()
        const diff6h = Math.abs(ts - cutoff6h)
        const diff24h = Math.abs(ts - cutoff24h)
        if (diff6h < closestDiff6h) {
          closestDiff6h = diff6h
          price6h = row.price
        }
        if (diff24h < closestDiff24h) {
          closestDiff24h = diff24h
          price24h = row.price
        }
      }

      const delta6h = price6h !== null ? Math.round((currentPrice - price6h) * 10) / 10 : 0
      const delta24h = price24h !== null ? Math.round((currentPrice - price24h) * 10) / 10 : 0

      // Acceleration: rate of change in last 6h vs daily rate
      const rate6h = delta6h / 6
      const rate24h = delta24h / 24 || 0.001
      const acceleration = Math.abs(rate6h) > 0.05 ? rate6h / rate24h : 1

      const breakout = detectBreakout(currentPrice, price6h, price24h)
      const momentum_score = computeMomentumScore(
        delta6h,
        delta24h,
        acceleration,
        topic.total_votes ?? 0,
      )

      // Build sparkline from last 12 data points
      const sparkline = rows.slice(-12).map((r) => Math.round(r.price))

      markets.push({
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        price: Math.round(currentPrice),
        volume: topic.total_votes ?? 0,
        delta_6h: delta6h,
        delta_24h: delta24h,
        acceleration,
        momentum_score,
        breakout_level: breakout?.level ?? null,
        breakout_direction: breakout?.direction ?? null,
        price_6h_ago: price6h !== null ? Math.round(price6h) : null,
        price_24h_ago: price24h !== null ? Math.round(price24h) : null,
        sparkline,
      })
    }

    // Classify into tabs
    const surging = [...markets]
      .filter((m) => m.delta_6h > 0 && m.acceleration >= 1)
      .sort((a, b) => b.momentum_score - a.momentum_score)
      .slice(0, 15)

    const falling = [...markets]
      .filter((m) => m.delta_6h < 0 && m.acceleration <= 1)
      .sort((a, b) => a.momentum_score - b.momentum_score)
      .slice(0, 15)

    const breakouts = [...markets]
      .filter((m) => m.breakout_level !== null)
      .sort((a, b) => Math.abs(b.delta_6h) - Math.abs(a.delta_6h))
      .slice(0, 15)

    const stalling = [...markets]
      .filter((m) => Math.abs(m.delta_24h) > 3 && Math.abs(m.delta_6h) < 1)
      .sort((a, b) => Math.abs(b.delta_24h) - Math.abs(a.delta_24h))
      .slice(0, 15)

    return NextResponse.json({
      surging,
      falling,
      breakouts,
      stalling,
      as_of: new Date().toISOString(),
    } satisfies MomentumResponse)
  } catch (err) {
    console.error('[/api/exchange/momentum]', err)
    return NextResponse.json(
      { surging: [], falling: [], breakouts: [], stalling: [], as_of: new Date().toISOString() },
      { status: 500 },
    )
  }
}
