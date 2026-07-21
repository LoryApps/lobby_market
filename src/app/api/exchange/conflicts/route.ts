import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConflictMarket {
  id: string
  statement: string
  category: string | null
  price: number       // 0–100 (blue_pct)
  status: string
  total_votes: number
}

export interface ConflictPair {
  market_a: ConflictMarket
  market_b: ConflictMarket
  correlation: number   // –1 to +1 (negative = typically opposed)
  conflict_score: number  // (price_a + price_b - 100) * |correlation|
  price_sum: number       // price_a + price_b — how far over 100
  shared_voters: number
}

export interface ConflictsResponse {
  pairs: ConflictPair[]
  total_markets_scanned: number
  computed_at: string
}

// ─── Pearson ──────────────────────────────────────────────────────────────────

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 5) return 0

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

// ─── Vote-based correlation (shared voters who voted opposite sides) ───────────

async function getVoteCorrelations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, { r: number; shared: number }>> {
  const result = new Map<string, { r: number; shared: number }>()

  // Use the existing SQL function if available, otherwise compute manually
  try {
    const { data } = await supabase.rpc('get_topic_correlations', {
      p_limit: 50,
      p_min_shared: 3,
    })

    for (const row of data ?? []) {
      const a = row.topic_a_id as string
      const b = row.topic_b_id as string
      if (ids.includes(a) && ids.includes(b)) {
        const key = [a, b].sort().join('|')
        result.set(key, {
          r: row.correlation as number,
          shared: row.shared_voters as number,
        })
      }
    }
  } catch {
    // Function might not exist — fall back to empty
  }

  return result
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const minConflict = parseFloat(searchParams.get('min') ?? '5')   // minimum conflict score
  const category    = searchParams.get('category') ?? null

  const supabase = await createClient()

  // Active / voting markets with decent volume
  let query = supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(60)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: topicsRaw } = await query

  const markets: ConflictMarket[] = (topicsRaw ?? []).map(t => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    price: Math.round(t.blue_pct ?? 50),
    status: t.status,
    total_votes: t.total_votes ?? 0,
  }))

  if (markets.length < 2) {
    return NextResponse.json({
      pairs: [],
      total_markets_scanned: markets.length,
      computed_at: new Date().toISOString(),
    } satisfies ConflictsResponse)
  }

  const ids = markets.map(m => m.id)

  // ── 1. Price history correlation ────────────────────────────────────────────
  const { data: historyRaw } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .in('topic_id', ids)
    .order('recorded_at', { ascending: true })

  const seriesMap = new Map<string, { bucket: number; price: number }[]>()
  for (const row of historyRaw ?? []) {
    const day = Math.floor(new Date(row.recorded_at).getTime() / (24 * 3600 * 1000))
    if (!seriesMap.has(row.topic_id)) seriesMap.set(row.topic_id, [])
    const arr = seriesMap.get(row.topic_id)!
    const existing = arr.find(p => p.bucket === day)
    if (existing) {
      existing.price = row.price
    } else {
      arr.push({ bucket: day, price: row.price })
    }
  }

  // ── 2. Vote alignment correlation (from DB function) ───────────────────────
  const voteCorr = await getVoteCorrelations(supabase, ids)

  // ── 3. Find conflict pairs ─────────────────────────────────────────────────
  const pairs: ConflictPair[] = []

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const a = markets[i]
      const b = markets[j]

      // Only flag as conflict when BOTH markets are priced above 50
      // (i.e. both lean toward YES — but they're negatively correlated)
      if (a.price <= 50 || b.price <= 50) continue

      const priceSum = a.price + b.price

      // Must sum to more than 100 to be a "conflict"
      if (priceSum <= 100) continue

      // Compute price-history correlation
      const histA = seriesMap.get(a.id) ?? []
      const histB = seriesMap.get(b.id) ?? []
      const [xs, ys] = alignSeries(histA, histB)
      const histR = pearson(xs, ys)

      // Blend with vote-alignment correlation if available
      const voteKey = [a.id, b.id].sort().join('|')
      const voteData = voteCorr.get(voteKey)
      const voteR = voteData?.r ?? 0
      const shared = voteData?.shared ?? 0

      // Weighted blend: price history takes precedence when we have 10+ data points
      const r = xs.length >= 10
        ? histR * 0.7 + voteR * 0.3
        : voteR

      // Only flag as conflict if negatively correlated
      if (r >= 0) continue

      const conflictScore = Math.round((priceSum - 100) * Math.abs(r) * 10) / 10

      if (conflictScore < minConflict) continue

      pairs.push({
        market_a: a,
        market_b: b,
        correlation: Math.round(r * 100) / 100,
        conflict_score: conflictScore,
        price_sum: priceSum,
        shared_voters: shared,
      })
    }
  }

  // Sort by conflict score descending
  pairs.sort((a, b) => b.conflict_score - a.conflict_score)

  return NextResponse.json({
    pairs: pairs.slice(0, 25),
    total_markets_scanned: markets.length,
    computed_at: new Date().toISOString(),
  } satisfies ConflictsResponse)
}
