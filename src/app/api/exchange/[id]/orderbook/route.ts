import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceBand {
  /** Lower bound of this band, e.g. 0, 5, 10 … 95 */
  lo: number
  /** Upper bound, e.g. 5, 10, 15 … 100 */
  hi: number
  /** Number of price snapshots that fell in this band */
  count: number
  /** Total volume (cumulative votes) at the snapshots in this band */
  volume: number
}

export interface RecentActivity {
  recorded_at: string
  price: number
  volume: number
  delta: number      // votes added since previous snapshot
  direction: 'up' | 'down' | 'flat'
}

export interface OrderbookData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    volume: number
    blue_votes: number
    red_votes: number
  }
  /** 20 bands of 5% width each (0–5, 5–10, … 95–100) */
  priceBands: PriceBand[]
  /** Cumulative FOR depth at each price level (for depth-chart rendering) */
  forDepth: Array<{ price: number; cumVol: number }>
  /** Cumulative AGAINST depth at each price level */
  againstDepth: Array<{ price: number; cumVol: number }>
  /** 50 most recent price history snapshots (newest first) */
  recentActivity: RecentActivity[]
  pressure: {
    /** Ratio of FOR vs AGAINST sentiment in latest snapshots (0–100) */
    buyPressure: number
    /** 24h volume */
    volume24h: number
    /** Average price in last 24h */
    avgPrice24h: number | null
    /** Price high in last 24h */
    high24h: number | null
    /** Price low in last 24h */
    low24h: number | null
    /** Number of distinct price levels visited in 24h (market breadth) */
    priceLevels24h: number
  }
  /** Maximum volume across all bands (for chart scaling) */
  maxBandVolume: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── 2. Full price history (all time) ──────────────────────────────────────
  const { data: history } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })

  const rows = (history ?? []) as Array<{ price: number; volume: number; recorded_at: string }>

  // ── 3. Price bands (5% each) ──────────────────────────────────────────────
  const bandCount = 20
  const bandWidth = 5
  const bands: PriceBand[] = Array.from({ length: bandCount }, (_, i) => ({
    lo: i * bandWidth,
    hi: (i + 1) * bandWidth,
    count: 0,
    volume: 0,
  }))

  for (const row of rows) {
    const clamped = Math.max(0, Math.min(99.99, row.price))
    const idx = Math.min(bandCount - 1, Math.floor(clamped / bandWidth))
    bands[idx].count += 1
    bands[idx].volume += row.volume
  }

  const maxBandVolume = Math.max(...bands.map(b => b.volume), 1)

  // ── 4. Depth curves ───────────────────────────────────────────────────────
  // FOR depth: cumulative volume from 100% down to current price (buyers
  // who want consensus to stay high)
  // AGAINST depth: cumulative volume from 0% up to current price
  const forDepth: Array<{ price: number; cumVol: number }> = []
  let cumFor = 0
  for (let p = 100; p >= 0; p -= bandWidth) {
    const bandIdx = Math.min(bandCount - 1, Math.floor(p / bandWidth))
    cumFor += (bands[bandIdx]?.volume ?? 0)
    forDepth.unshift({ price: p, cumVol: cumFor })
  }

  const againstDepth: Array<{ price: number; cumVol: number }> = []
  let cumAgainst = 0
  for (let p = 0; p <= 100; p += bandWidth) {
    const bandIdx = Math.min(bandCount - 1, Math.floor(p / bandWidth))
    cumAgainst += (bands[bandIdx]?.volume ?? 0)
    againstDepth.push({ price: p, cumVol: cumAgainst })
  }

  // ── 5. Recent activity (last 50 snapshots) ────────────────────────────────
  const recentRows = rows.slice(-50)
  const recentActivity: RecentActivity[] = recentRows.map((row, i) => {
    const prev = recentRows[i - 1]
    const delta = prev ? row.volume - prev.volume : 0
    const direction: 'up' | 'down' | 'flat' =
      row.price > (prev?.price ?? row.price) ? 'up'
      : row.price < (prev?.price ?? row.price) ? 'down'
      : 'flat'
    return {
      recorded_at: row.recorded_at,
      price: Math.round(row.price),
      volume: row.volume,
      delta,
      direction,
    }
  }).reverse()

  // ── 6. Pressure metrics (last 24h) ────────────────────────────────────────
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const rows24h = rows.filter(r => r.recorded_at >= cutoff24h)

  let volume24h = 0
  let avgPrice24h: number | null = null
  let high24h: number | null = null
  let low24h: number | null = null
  const priceLevelsSet = new Set<number>()
  let upMoves = 0
  let downMoves = 0

  if (rows24h.length > 0) {
    const firstVol = rows24h[0].volume
    const lastVol = rows24h[rows24h.length - 1].volume
    volume24h = lastVol - firstVol
    avgPrice24h = rows24h.reduce((s, r) => s + r.price, 0) / rows24h.length
    high24h = Math.max(...rows24h.map(r => r.price))
    low24h = Math.min(...rows24h.map(r => r.price))
    for (const r of rows24h) {
      priceLevelsSet.add(Math.round(r.price / 5) * 5)
    }
    for (let i = 1; i < rows24h.length; i++) {
      if (rows24h[i].price > rows24h[i - 1].price) upMoves++
      else if (rows24h[i].price < rows24h[i - 1].price) downMoves++
    }
  }

  const totalMoves = upMoves + downMoves
  const buyPressure = totalMoves > 0 ? Math.round((upMoves / totalMoves) * 100) : 50

  const data: OrderbookData = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price: Math.round(topic.blue_pct ?? 50),
      volume: topic.total_votes ?? 0,
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
    },
    priceBands: bands,
    forDepth,
    againstDepth,
    recentActivity,
    pressure: {
      buyPressure,
      volume24h,
      avgPrice24h: avgPrice24h !== null ? Math.round(avgPrice24h) : null,
      high24h: high24h !== null ? Math.round(high24h) : null,
      low24h: low24h !== null ? Math.round(low24h) : null,
      priceLevels24h: priceLevelsSet.size,
    },
    maxBandVolume,
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
