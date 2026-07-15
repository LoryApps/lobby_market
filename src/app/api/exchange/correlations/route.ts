import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrelationMarket {
  id: string
  statement: string
  category: string | null
  price: number
  volume: number
  status: string
}

export interface CorrelationPair {
  id_a: string
  id_b: string
  r: number          // Pearson coefficient –1 to +1 (2 decimal places)
  n: number          // Number of overlapping time points used
}

export interface CorrelationsResponse {
  markets: CorrelationMarket[]
  pairs: CorrelationPair[]
  computed_at: string
}

// ─── Pearson correlation ──────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 3) return 0

  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n

  let num = 0, sx = 0, sy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    sx  += dx * dx
    sy  += dy * dy
  }
  const denom = Math.sqrt(sx * sy)
  return denom === 0 ? 0 : num / denom
}

// ─── Align two price series to a shared time grid ────────────────────────────

function alignSeries(
  histA: { bucket: number; price: number }[],
  histB: { bucket: number; price: number }[],
): [number[], number[]] {
  const mapB = new Map(histB.map(p => [p.bucket, p.price]))
  const xs: number[] = []
  const ys: number[] = []
  for (const { bucket, price } of histA) {
    if (mapB.has(bucket)) {
      xs.push(price)
      ys.push(mapB.get(bucket)!)
    }
  }
  return [xs, ys]
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Top 20 non-proposed markets by volume — enough to make a readable matrix
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .not('status', 'in', '("proposed")')
    .order('total_votes', { ascending: false })
    .limit(20)

  const markets: CorrelationMarket[] = (topicsRaw ?? []).map(t => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    price: Math.round(t.blue_pct ?? 50),
    volume: t.total_votes ?? 0,
    status: t.status,
  }))

  if (markets.length < 2) {
    return NextResponse.json({
      markets,
      pairs: [],
      computed_at: new Date().toISOString(),
    } satisfies CorrelationsResponse)
  }

  const ids = markets.map(m => m.id)

  // Pull price history for all these markets — bucket into ~daily bins by
  // counting days since epoch so alignment is simpler.
  const { data: historyRaw } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .in('topic_id', ids)
    .order('recorded_at', { ascending: true })

  // Group by topic and bucket to day-of-epoch
  const seriesMap = new Map<string, { bucket: number; price: number }[]>()
  for (const row of historyRaw ?? []) {
    const day = Math.floor(new Date(row.recorded_at).getTime() / (24 * 3600 * 1000))
    if (!seriesMap.has(row.topic_id)) seriesMap.set(row.topic_id, [])
    // Keep last price per day
    const arr = seriesMap.get(row.topic_id)!
    const existing = arr.find(p => p.bucket === day)
    if (existing) {
      existing.price = row.price
    } else {
      arr.push({ bucket: day, price: row.price })
    }
  }

  // Compute pairwise correlations
  const pairs: CorrelationPair[] = []
  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const a = markets[i].id
      const b = markets[j].id
      const histA = seriesMap.get(a) ?? []
      const histB = seriesMap.get(b) ?? []
      const [xs, ys] = alignSeries(histA, histB)
      const r = pearson(xs, ys)
      pairs.push({
        id_a: a,
        id_b: b,
        r: Math.round(r * 100) / 100,
        n: xs.length,
      })
    }
  }

  return NextResponse.json({
    markets,
    pairs,
    computed_at: new Date().toISOString(),
  } satisfies CorrelationsResponse)
}
