import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryFlow {
  category: string
  avg_price: number
  delta_1h: number
  delta_6h: number
  volume: number
  active_markets: number
  direction: 'rising' | 'falling' | 'stable'
  intensity: number // 0-100 — how strong the momentum is
}

export interface FlowTick {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  delta_1h: number
  volume: number
  direction: 'for' | 'against' | 'neutral'
}

export interface FlowStats {
  total_markets: number
  advancing: number
  declining: number
  unchanged: number
  total_volume: number
  avg_price: number
  breadth: number // advancing / total, 0-1
}

export interface FlowResponse {
  category_flows: CategoryFlow[]
  ticks: FlowTick[]
  stats: FlowStats
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

// ─── Fallback ─────────────────────────────────────────────────────────────────

function fallback(): FlowResponse {
  return {
    category_flows: [],
    ticks: [],
    stats: {
      total_markets: 0,
      advancing: 0,
      declining: 0,
      unchanged: 0,
      total_volume: 0,
      avg_price: 50,
      breadth: 0.5,
    },
    generated_at: new Date().toISOString(),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // All active + voting topics
    const { data: topics, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .in('category', CATEGORIES as unknown as string[])
      .order('total_votes', { ascending: false })

    if (topicErr || !topics || topics.length === 0) return NextResponse.json(fallback())

    const topicIds = topics.map((t) => t.id as string)

    // Fetch last 7h of price history for delta computation
    const cutoff = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
    const { data: history } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, recorded_at')
      .gt('recorded_at', cutoff)
      .in('topic_id', topicIds)
      .order('recorded_at', { ascending: true })

    // Build per-topic: earliest record (≈6h ago) and record closest to 1h ago
    const oldest = new Map<string, number>()   // earliest in window = 6h proxy
    const oneHour = new Map<string, number>()  // record in 1-2h window

    const now = Date.now()
    const oneHourMs = 60 * 60 * 1000

    for (const row of history ?? []) {
      const id = row.topic_id as string
      const ts = new Date(row.recorded_at as string).getTime()
      const price = row.price as number

      // 6h proxy: earliest record we have
      if (!oldest.has(id)) oldest.set(id, price)

      // 1h proxy: last record older than 55 minutes
      if (ts <= now - 55 * 60 * 1000 && ts >= now - 2 * oneHourMs) {
        oneHour.set(id, price) // overwrite to keep latest within window
      }
    }

    // ── Per-topic deltas ──────────────────────────────────────────────────────
    let totalPrice = 0
    let advancing = 0, declining = 0, unchanged = 0

    const ticks: FlowTick[] = topics.map((t) => {
      const id = t.id as string
      const price = Math.round((t.blue_pct as number) ?? 50)
      const volume = (t.total_votes as number) ?? 0
      const price1h = oneHour.get(id) ?? price
      const delta1h = Math.round((price - price1h) * 10) / 10

      totalPrice += price
      if (delta1h > 0.5) advancing++
      else if (delta1h < -0.5) declining++
      else unchanged++

      return {
        id,
        statement: t.statement as string,
        category: t.category as string | null,
        status: t.status as string,
        price,
        delta_1h: delta1h,
        volume,
        direction: price >= 52 ? 'for' : price <= 48 ? 'against' : 'neutral',
      }
    })

    const stats: FlowStats = {
      total_markets: topics.length,
      advancing,
      declining,
      unchanged,
      total_volume: topics.reduce((s, t) => s + ((t.total_votes as number) ?? 0), 0),
      avg_price: topics.length > 0 ? Math.round(totalPrice / topics.length) : 50,
      breadth: topics.length > 0 ? advancing / topics.length : 0.5,
    }

    // Sort ticks by |delta_1h| desc, then by volume
    ticks.sort((a, b) => Math.abs(b.delta_1h) - Math.abs(a.delta_1h) || b.volume - a.volume)
    const topTicks = ticks.slice(0, 24)

    // ── Category aggregates ───────────────────────────────────────────────────
    const catMap = new Map<
      string,
      {
        prices: number[]
        prices1h: number[]
        prices6h: number[]
        volume: number
        count: number
      }
    >()
    for (const cat of CATEGORIES) {
      catMap.set(cat, { prices: [], prices1h: [], prices6h: [], volume: 0, count: 0 })
    }

    for (const t of topics) {
      const cat = t.category as string
      if (!cat || !catMap.has(cat)) continue
      const agg = catMap.get(cat)!
      const id = t.id as string
      const price = Math.round((t.blue_pct as number) ?? 50)
      const price1h = oneHour.get(id) ?? price
      const price6h = oldest.get(id) ?? price

      agg.prices.push(price)
      agg.prices1h.push(price1h)
      agg.prices6h.push(price6h)
      agg.volume += (t.total_votes as number) ?? 0
      agg.count++
    }

    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 50

    const category_flows: CategoryFlow[] = CATEGORIES.map((cat) => {
      const agg = catMap.get(cat)!
      const avgPrice = avg(agg.prices)
      const delta1h = Math.round((avgPrice - avg(agg.prices1h)) * 10) / 10
      const delta6h = Math.round((avgPrice - avg(agg.prices6h)) * 10) / 10

      const direction: CategoryFlow['direction'] =
        delta1h > 0.5 ? 'rising' : delta1h < -0.5 ? 'falling' : 'stable'

      // Intensity: scale |delta_1h| to 0-100 (max meaningful is ~5 points)
      const intensity = Math.min(100, Math.round(Math.abs(delta1h) * 20))

      return {
        category: cat,
        avg_price: avgPrice,
        delta_1h: delta1h,
        delta_6h: delta6h,
        volume: agg.volume,
        active_markets: agg.count,
        direction,
        intensity,
      }
    }).sort((a, b) => b.volume - a.volume)

    return NextResponse.json({
      category_flows,
      ticks: topTicks,
      stats,
      generated_at: new Date().toISOString(),
    } satisfies FlowResponse)
  } catch (err) {
    console.error('[/api/exchange/flow]', err)
    return NextResponse.json(fallback())
  }
}
