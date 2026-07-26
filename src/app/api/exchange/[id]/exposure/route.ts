import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrelatedMarket {
  id: string
  statement: string
  category: string | null
  price: number
  status: string
  total_votes: number
  correlation: number   // –1 to 1
  overlap_days: number  // how many days of shared history
}

export interface ExposureData {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  total_votes: number

  // Category context
  category_avg_price: number | null   // avg price of all topics in category
  category_topic_count: number
  category_beta: number | null        // correlation vs category avg (–1 to 1)
  tracking_deviation: number | null   // abs(price – category_avg)

  // Cross-market correlations
  top_correlated: CorrelatedMarket[]    // highest positive correlation
  top_inversely: CorrelatedMarket[]     // highest negative correlation

  // Market positioning
  price_percentile: number    // 0–100, where this sits vs all active markets
  vote_percentile: number     // 0–100 by volume

  // Sensitivity
  price_velocity_7d: number   // avg daily price change over last 7 days
  vote_velocity_7d: number    // avg daily vote count over last 7 days

  // Data coverage
  history_days: number        // how many days of price history we have
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 3) return null

  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n

  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const ex = xs[i] - mx
    const ey = ys[i] - my
    num += ex * ey
    dx += ex * ex
    dy += ey * ey
  }

  const denom = Math.sqrt(dx * dy)
  if (denom === 0) return null
  return Math.max(-1, Math.min(1, num / denom))
}

// Convert a list of (date, price) snapshots to a daily price map
function toDailyMap(
  snaps: { recorded_at: string; price: number }[],
): Map<string, number> {
  const map = new Map<string, number[]>()
  for (const s of snaps) {
    const day = s.recorded_at.slice(0, 10)
    if (!map.has(day)) map.set(day, [])
    map.get(day)!.push(s.price)
  }
  const result = new Map<string, number>()
  for (const [day, prices] of map) {
    result.set(day, prices.reduce((a, b) => a + b, 0) / prices.length)
  }
  return result
}

// Correlate two daily-price maps over their overlapping days
function correlate(
  a: Map<string, number>,
  b: Map<string, number>,
): { correlation: number | null; overlap_days: number } {
  const days: string[] = []
  for (const day of a.keys()) {
    if (b.has(day)) days.push(day)
  }
  days.sort()
  if (days.length < 3) return { correlation: null, overlap_days: days.length }
  const xs = days.map((d) => a.get(d)!)
  const ys = days.map((d) => b.get(d)!)
  return { correlation: pearsonCorrelation(xs, ys), overlap_days: days.length }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // 1. Fetch the target market
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  // 2. Fetch price history for this market (last 60 days)
  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString()

  const { data: ownHistory } = await supabase
    .from('topic_price_history')
    .select('price, recorded_at')
    .eq('topic_id', params.id)
    .gte('recorded_at', since60)
    .order('recorded_at', { ascending: true })

  const ownSnaps = ownHistory ?? []
  const ownDailyMap = toDailyMap(ownSnaps)
  const historyDays = ownDailyMap.size

  // Price velocity (last 7 days)
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const recent7 = ownSnaps.filter((s) => s.recorded_at >= since7)
  let priceVelocity7d = 0
  if (recent7.length >= 2) {
    const sorted = [...recent7].sort((a, b) =>
      a.recorded_at.localeCompare(b.recorded_at),
    )
    priceVelocity7d =
      (sorted[sorted.length - 1].price - sorted[0].price) /
      Math.max(1, (new Date(sorted[sorted.length - 1].recorded_at).getTime() - new Date(sorted[0].recorded_at).getTime()) / 86_400_000)
  }

  // 3. Fetch candidate markets (same category + global top by votes)
  type CandidateRow = { id: string; statement: string; category: string | null; status: string; blue_pct: number | null; total_votes: number | null }

  const globalRes = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .neq('id', params.id)
    .eq('status', 'active')
    .order('total_votes', { ascending: false })
    .limit(50)

  const allGlobal: CandidateRow[] = (globalRes.data ?? []) as CandidateRow[]

  // Merge candidate list, deduplicate; category topics first
  const seenIds = new Set<string>([params.id])
  const candidates: CandidateRow[] = []

  for (const row of allGlobal) {
    if (!seenIds.has(row.id)) {
      seenIds.add(row.id)
      candidates.push(row)
    }
  }

  // 4. Category stats (filter from global list)
  const categoryTopics = allGlobal.filter((t) => t.category === topic.category)
  const categoryAvgPrice = categoryTopics.length > 0
    ? categoryTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / categoryTopics.length
    : null
  const categoryTopicCount = categoryTopics.length + 1 // include self

  // 5. Fetch price histories for all candidates in parallel (batched)
  const BATCH = 15
  const allHistories = new Map<string, Map<string, number>>()

  // Add own history
  allHistories.set(params.id, ownDailyMap)

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH).map((c) => c.id)
    const { data: batchHistory } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, recorded_at')
      .in('topic_id', batch)
      .gte('recorded_at', since60)
      .order('recorded_at', { ascending: true })

    // Group by topic_id
    const grouped = new Map<string, { recorded_at: string; price: number }[]>()
    for (const row of batchHistory ?? []) {
      if (!grouped.has(row.topic_id)) grouped.set(row.topic_id, [])
      grouped.get(row.topic_id)!.push({ recorded_at: row.recorded_at, price: row.price })
    }

    for (const [topicId, snaps] of grouped) {
      allHistories.set(topicId, toDailyMap(snaps))
    }
  }

  // 6. Build category daily map (average of all category markets per day)
  const categoryMarketIds = categoryTopics.map((t) => t.id)
  let categoryBeta: number | null = null

  if (categoryMarketIds.length >= 3 && ownDailyMap.size >= 3) {
    const categoryDailyMap = new Map<string, number>()
    const dayTotals = new Map<string, { sum: number; count: number }>()
    for (const cId of categoryMarketIds) {
      const cMap = allHistories.get(cId)
      if (!cMap) continue
      for (const [day, price] of cMap) {
        const agg = dayTotals.get(day) ?? { sum: 0, count: 0 }
        agg.sum += price
        agg.count++
        dayTotals.set(day, agg)
      }
    }
    for (const [day, { sum, count }] of dayTotals) {
      if (count >= 2) categoryDailyMap.set(day, sum / count)
    }
    const { correlation } = correlate(ownDailyMap, categoryDailyMap)
    categoryBeta = correlation
  }

  // 7. Correlate with each candidate
  const correlations: (CorrelatedMarket & { _raw: number })[] = []

  for (const cand of candidates) {
    const cMap = allHistories.get(cand.id)
    if (!cMap || cMap.size < 3) continue

    const { correlation, overlap_days } = correlate(ownDailyMap, cMap)
    if (correlation === null || overlap_days < 3) continue

    correlations.push({
      id: cand.id,
      statement: cand.statement,
      category: cand.category,
      price: Math.round(cand.blue_pct ?? 50),
      status: cand.status,
      total_votes: cand.total_votes ?? 0,
      correlation: Math.round(correlation * 100) / 100,
      overlap_days,
      _raw: correlation,
    })
  }

  // Sort and split
  const sorted = [...correlations].sort((a, b) => b._raw - a._raw)
  const topCorrelated = sorted
    .filter((c) => c._raw >= 0.25)
    .slice(0, 5)
    .map(({ _raw: _unused, ...rest }) => rest) as CorrelatedMarket[]

  const topInversely = sorted
    .filter((c) => c._raw <= -0.25)
    .reverse()
    .slice(0, 3)
    .map(({ _raw: _unused, ...rest }) => rest) as CorrelatedMarket[]

  // 8. Price & vote percentiles across active topics
  const { data: allActive } = await supabase
    .from('topics')
    .select('blue_pct, total_votes')
    .eq('status', 'active')
    .order('total_votes', { ascending: true })

  let pricePercentile = 50
  let votePercentile = 50

  if (allActive && allActive.length > 0) {
    const prices = allActive.map((t) => t.blue_pct ?? 50).sort((a, b) => a - b)
    const votes = allActive.map((t) => t.total_votes ?? 0).sort((a, b) => a - b)
    const myPrice = topic.blue_pct ?? 50
    const myVotes = topic.total_votes ?? 0

    pricePercentile = Math.round(
      (prices.filter((p) => p <= myPrice).length / prices.length) * 100,
    )
    votePercentile = Math.round(
      (votes.filter((v) => v <= myVotes).length / votes.length) * 100,
    )
  }

  // 9. Vote velocity (7d from DB)
  const { data: voteHistory7d } = await supabase
    .from('topic_price_history')
    .select('volume, recorded_at')
    .eq('topic_id', params.id)
    .gte('recorded_at', since7)
    .order('recorded_at', { ascending: true })

  let voteVelocity7d = 0
  if (voteHistory7d && voteHistory7d.length >= 2) {
    const first = voteHistory7d[0]
    const last = voteHistory7d[voteHistory7d.length - 1]
    const daySpan = Math.max(
      1,
      (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / 86_400_000,
    )
    voteVelocity7d = (last.volume - first.volume) / daySpan
  }

  const result: ExposureData = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    price: Math.round(topic.blue_pct ?? 50),
    total_votes: topic.total_votes ?? 0,

    category_avg_price: categoryAvgPrice !== null ? Math.round(categoryAvgPrice) : null,
    category_topic_count: categoryTopicCount,
    category_beta: categoryBeta !== null ? Math.round(categoryBeta * 100) / 100 : null,
    tracking_deviation:
      categoryAvgPrice !== null
        ? Math.round(Math.abs((topic.blue_pct ?? 50) - categoryAvgPrice))
        : null,

    top_correlated: topCorrelated,
    top_inversely: topInversely,

    price_percentile: pricePercentile,
    vote_percentile: votePercentile,

    price_velocity_7d: Math.round(priceVelocity7d * 10) / 10,
    vote_velocity_7d: Math.round(voteVelocity7d),

    history_days: historyDays,
  }

  return NextResponse.json(result)
}
