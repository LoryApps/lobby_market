import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectorMarket {
  id: string
  statement: string
  status: string
  price: number
  volume: number
  price_change_24h: number | null
}

export interface SectorResolvedMarket {
  id: string
  statement: string
  status: 'law' | 'failed'
  final_price: number
  volume: number
  resolved_at: string
}

export interface SectorPriceTick {
  date: string
  avg_price: number
  market_count: number
}

export interface SectorDetail {
  category: string
  // Live stats
  total_markets: number
  active_count: number
  voting_count: number
  proposed_count: number
  law_count: number
  failed_count: number
  total_volume: number
  avg_price: number | null
  price_change_24h: number | null
  sentiment: 'strong_for' | 'leaning_for' | 'contested' | 'leaning_against' | 'strong_against' | 'no_data'
  // Live markets sorted by volume
  markets: SectorMarket[]
  // Resolved history
  resolved: SectorResolvedMarket[]
  // Daily price history for the sector (last 30 days)
  price_history: SectorPriceTick[]
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set([
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
])

function toSentiment(price: number | null): SectorDetail['sentiment'] {
  if (price === null) return 'no_data'
  if (price >= 72) return 'strong_for'
  if (price >= 58) return 'leaning_for'
  if (price >= 42) return 'contested'
  if (price >= 28) return 'leaning_against'
  return 'strong_against'
}

// ─── Route ────────────────────────────────────────────────────────────────────

interface Ctx { params: { category: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const category = decodeURIComponent(params.category)

  if (!VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 })
  }

  const supabase = await createClient()

  // ── 1. All topics in this category ─────────────────────────────────────────
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, status, blue_pct, total_votes, created_at, resolved_at')
    .eq('category', category)
    .order('total_votes', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── 2. 24h price history for this category ─────────────────────────────────
  const cutoff24h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const topicIds = (topics ?? []).map((t) => t.id as string)

  const { data: history24h } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .in('topic_id', topicIds.length > 0 ? topicIds : ['00000000-0000-0000-0000-000000000000'])
    .gt('recorded_at', cutoff24h)
    .order('recorded_at', { ascending: true })

  const priceAt24hAgo = new Map<string, number>()
  for (const row of history24h ?? []) {
    if (!priceAt24hAgo.has(row.topic_id)) {
      priceAt24hAgo.set(row.topic_id, row.price as number)
    }
  }

  // ── 3. 30-day daily price history for the sector ───────────────────────────
  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: history30d } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .in('topic_id', topicIds.length > 0 ? topicIds : ['00000000-0000-0000-0000-000000000000'])
    .gt('recorded_at', cutoff30d)
    .order('recorded_at', { ascending: true })

  // Bucket by day and average
  const dayBuckets = new Map<string, { sum: number; count: number }>()
  for (const row of history30d ?? []) {
    const day = (row.recorded_at as string).slice(0, 10)
    const existing = dayBuckets.get(day) ?? { sum: 0, count: 0 }
    existing.sum += row.price as number
    existing.count++
    dayBuckets.set(day, existing)
  }

  const price_history: SectorPriceTick[] = Array.from(dayBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      avg_price: Math.round((sum / count) * 10) / 10,
      market_count: count,
    }))

  // ── 4. Aggregate stats ─────────────────────────────────────────────────────
  let active_count = 0, voting_count = 0, proposed_count = 0, law_count = 0, failed_count = 0
  let total_volume = 0, price_sum = 0, price_count = 0
  const price_changes: number[] = []

  const livePriceMap = new Map<string, number>()
  for (const t of topics ?? []) {
    livePriceMap.set(t.id as string, (t.blue_pct as number) ?? 50)
  }

  const markets: SectorMarket[] = []
  const resolved: SectorResolvedMarket[] = []

  for (const t of topics ?? []) {
    const status = t.status as string
    const votes = (t.total_votes as number) ?? 0
    const price = (t.blue_pct as number) ?? 50
    total_volume += votes

    if (status === 'active') {
      active_count++
      price_sum += price
      price_count++
    } else if (status === 'voting') {
      voting_count++
      price_sum += price
      price_count++
    } else if (status === 'proposed') {
      proposed_count++
    } else if (status === 'law') {
      law_count++
    } else if (status === 'failed') {
      failed_count++
    }

    // 24h change for live markets
    if (status === 'active' || status === 'voting') {
      const old = priceAt24hAgo.get(t.id as string)
      if (old !== undefined) price_changes.push(price - old)

      markets.push({
        id: t.id as string,
        statement: t.statement as string,
        status,
        price,
        volume: votes,
        price_change_24h: old !== undefined ? Math.round((price - old) * 10) / 10 : null,
      })
    }

    if (status === 'law' || status === 'failed') {
      resolved.push({
        id: t.id as string,
        statement: t.statement as string,
        status,
        final_price: price,
        volume: votes,
        resolved_at: (t.resolved_at as string | null) ?? (t.created_at as string),
      })
    }
  }

  // Sort markets by volume desc (already sorted from DB but reaffirm)
  markets.sort((a, b) => b.volume - a.volume)
  // Sort resolved by date desc
  resolved.sort((a, b) => b.resolved_at.localeCompare(a.resolved_at))

  const avg_price = price_count > 0 ? Math.round((price_sum / price_count) * 10) / 10 : null
  const price_change_24h =
    price_changes.length > 0
      ? Math.round((price_changes.reduce((s, v) => s + v, 0) / price_changes.length) * 10) / 10
      : null

  const detail: SectorDetail = {
    category,
    total_markets: (topics ?? []).length,
    active_count,
    voting_count,
    proposed_count,
    law_count,
    failed_count,
    total_volume,
    avg_price,
    price_change_24h,
    sentiment: toSentiment(avg_price),
    markets: markets.slice(0, 50),
    resolved: resolved.slice(0, 30),
    price_history,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(detail)
}
