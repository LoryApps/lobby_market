import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoverTopic {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  open_price: number
  high_price: number
  low_price: number
  delta: number        // current - open (24h change in ¢)
  delta_pct: number    // delta as % of open price
  range: number        // high - low (volatility proxy)
  volume: number       // total_votes
  vol_delta: number    // volume added in 24h window
  is_hot: boolean
  is_near_law: boolean
}

export interface MoversResponse {
  gainers: MoverTopic[]
  losers: MoverTopic[]
  volatile: MoverTopic[]
  high_volume: MoverTopic[]
  as_of: string
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toMover(rows: {
  topic_id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  min_price: number
  max_price: number
  open_price: number
  close_price: number
  open_volume: number
  close_volume: number
}): MoverTopic {
  const delta = Math.round((rows.close_price - rows.open_price) * 10) / 10
  const openSafe = rows.open_price === 0 ? 1 : rows.open_price
  const delta_pct = Math.round((delta / openSafe) * 1000) / 10
  const range = Math.round((rows.max_price - rows.min_price) * 10) / 10

  return {
    id: rows.topic_id,
    statement: rows.statement,
    category: rows.category,
    status: rows.status,
    current_price: Math.round(rows.close_price),
    open_price: Math.round(rows.open_price),
    high_price: Math.round(rows.max_price),
    low_price: Math.round(rows.min_price),
    delta,
    delta_pct,
    range,
    volume: rows.total_votes,
    vol_delta: Math.max(0, rows.close_volume - rows.open_volume),
    is_hot: rows.total_votes > 200,
    is_near_law: rows.close_price >= 65,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Pull all price history snapshots in the last 24 h
    const { data: history, error: hErr } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, volume, recorded_at')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })

    if (hErr || !history || history.length === 0) {
      // Fallback: show markets sorted by current price extremes
      const { data: fallback } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .not('status', 'in', '("proposed")')
        .order('total_votes', { ascending: false })
        .limit(40)

      const markets: MoverTopic[] = (fallback ?? []).map((t) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        current_price: Math.round(t.blue_pct ?? 50),
        open_price: Math.round(t.blue_pct ?? 50),
        high_price: Math.round(t.blue_pct ?? 50),
        low_price: Math.round(t.blue_pct ?? 50),
        delta: 0,
        delta_pct: 0,
        range: 0,
        volume: t.total_votes ?? 0,
        vol_delta: 0,
        is_hot: (t.total_votes ?? 0) > 200,
        is_near_law: (t.blue_pct ?? 50) >= 65,
      }))

      return NextResponse.json({
        gainers: markets.slice(0, 10),
        losers: [],
        volatile: markets.slice(0, 10),
        high_volume: markets.slice(0, 10),
        as_of: new Date().toISOString(),
      } satisfies MoversResponse)
    }

    // Group by topic_id, compute open/close/high/low per topic
    type Acc = {
      open_price: number
      open_volume: number
      close_price: number
      close_volume: number
      max_price: number
      min_price: number
    }
    const byTopic = new Map<string, Acc>()

    for (const row of history) {
      const id = row.topic_id as string
      const price = row.price as number
      const volume = row.volume as number

      if (!byTopic.has(id)) {
        byTopic.set(id, {
          open_price: price,
          open_volume: volume,
          close_price: price,
          close_volume: volume,
          max_price: price,
          min_price: price,
        })
      } else {
        const acc = byTopic.get(id)!
        acc.close_price = price
        acc.close_volume = volume
        if (price > acc.max_price) acc.max_price = price
        if (price < acc.min_price) acc.min_price = price
      }
    }

    // Fetch topic metadata for all seen IDs
    const topicIds = Array.from(byTopic.keys())
    const { data: topicMeta } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)
      .not('status', 'in', '("proposed")')

    if (!topicMeta || topicMeta.length === 0) {
      return NextResponse.json({
        gainers: [],
        losers: [],
        volatile: [],
        high_volume: [],
        as_of: new Date().toISOString(),
      } satisfies MoversResponse)
    }

    const movers: MoverTopic[] = topicMeta.map((t) => {
      const acc = byTopic.get(t.id)!
      return toMover({
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_votes: t.total_votes ?? 0,
        blue_pct: t.blue_pct ?? 50,
        min_price: acc.min_price,
        max_price: acc.max_price,
        open_price: acc.open_price,
        close_price: acc.close_price,
        open_volume: acc.open_volume,
        close_volume: acc.close_volume,
      })
    })

    // Sort slices
    const gainers = [...movers]
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10)

    const losers = [...movers]
      .filter((m) => m.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 10)

    const volatile = [...movers]
      .sort((a, b) => b.range - a.range)
      .slice(0, 10)

    const high_volume = [...movers]
      .sort((a, b) => b.vol_delta - a.vol_delta)
      .slice(0, 10)

    return NextResponse.json({
      gainers,
      losers,
      volatile,
      high_volume,
      as_of: new Date().toISOString(),
    } satisfies MoversResponse)
  } catch (err) {
    console.error('[/api/exchange/movers]', err)
    return NextResponse.json(
      { gainers: [], losers: [], volatile: [], high_volume: [], as_of: new Date().toISOString() },
      { status: 500 },
    )
  }
}
