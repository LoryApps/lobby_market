import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategorySector {
  category: string
  // Market counts by status
  total_markets: number
  active_count: number
  voting_count: number
  proposed_count: number
  law_count: number
  failed_count: number
  // Volume
  total_volume: number
  // Consensus (avg price for active + voting topics)
  avg_price: number | null
  // Sentiment label derived from avg_price
  sentiment: 'strong_for' | 'leaning_for' | 'contested' | 'leaning_against' | 'strong_against' | 'no_data'
  // Top topic by volume
  top_topic: {
    id: string
    statement: string
    price: number
    volume: number
    status: string
  } | null
  // 24h price change (null if no history)
  price_change_24h: number | null
}

export interface CategoriesResponse {
  sectors: CategorySector[]
  total_volume: number
  total_markets: number
  generated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function toSentiment(price: number | null): CategorySector['sentiment'] {
  if (price === null) return 'no_data'
  if (price >= 72) return 'strong_for'
  if (price >= 58) return 'leaning_for'
  if (price >= 42) return 'contested'
  if (price >= 28) return 'leaning_against'
  return 'strong_against'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch all topics with category data
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('category', CATEGORIES)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch 24h price history to compute per-category price movement
  // Use recorded_at > now - 25h to get "yesterday's" snapshot
  const cutoff24h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const { data: history } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .gt('recorded_at', cutoff24h)
    .order('recorded_at', { ascending: true })

  // Build a map of topicId → earliest price in the last 24h window
  const priceAt24hAgo = new Map<string, number>()
  for (const row of history ?? []) {
    if (!priceAt24hAgo.has(row.topic_id)) {
      priceAt24hAgo.set(row.topic_id, row.price as number)
    }
  }

  // Aggregate by category
  const sectorMap = new Map<
    string,
    {
      active_ids: string[]
      voting_ids: string[]
      proposed_count: number
      law_count: number
      failed_count: number
      total_volume: number
      price_sum: number
      price_count: number
      top_topic: CategorySector['top_topic']
      price_changes: number[]
    }
  >()

  for (const cat of CATEGORIES) {
    sectorMap.set(cat, {
      active_ids: [],
      voting_ids: [],
      proposed_count: 0,
      law_count: 0,
      failed_count: 0,
      total_volume: 0,
      price_sum: 0,
      price_count: 0,
      top_topic: null,
      price_changes: [],
    })
  }

  for (const t of topics ?? []) {
    const cat = t.category as string
    if (!cat || !sectorMap.has(cat)) continue
    const agg = sectorMap.get(cat)!

    const votes = (t.total_votes as number) ?? 0
    const price = (t.blue_pct as number) ?? 50
    const status = t.status as string

    agg.total_volume += votes

    if (status === 'active') {
      agg.active_ids.push(t.id as string)
      agg.price_sum += price
      agg.price_count++
    } else if (status === 'voting') {
      agg.voting_ids.push(t.id as string)
      agg.price_sum += price
      agg.price_count++
    } else if (status === 'proposed') {
      agg.proposed_count++
    } else if (status === 'law') {
      agg.law_count++
    } else if (status === 'failed') {
      agg.failed_count++
    }

    // Track best top topic (highest volume among active/voting)
    if ((status === 'active' || status === 'voting') && votes > (agg.top_topic?.volume ?? -1)) {
      agg.top_topic = {
        id: t.id as string,
        statement: t.statement as string,
        price,
        volume: votes,
        status,
      }
    }

    // Track 24h price change for active/voting topics
    if (status === 'active' || status === 'voting') {
      const oldPrice = priceAt24hAgo.get(t.id as string)
      if (oldPrice !== undefined) {
        agg.price_changes.push(price - oldPrice)
      }
    }
  }

  // Build result
  let totalVolume = 0
  let totalMarkets = 0

  const sectors: CategorySector[] = CATEGORIES.map((cat) => {
    const agg = sectorMap.get(cat)!
    const active_count = agg.active_ids.length
    const voting_count = agg.voting_ids.length
    const total_markets =
      active_count + voting_count + agg.proposed_count + agg.law_count + agg.failed_count
    const avg_price = agg.price_count > 0 ? agg.price_sum / agg.price_count : null
    const price_change_24h =
      agg.price_changes.length > 0
        ? agg.price_changes.reduce((s, v) => s + v, 0) / agg.price_changes.length
        : null

    totalVolume += agg.total_volume
    totalMarkets += total_markets

    return {
      category: cat,
      total_markets,
      active_count,
      voting_count,
      proposed_count: agg.proposed_count,
      law_count: agg.law_count,
      failed_count: agg.failed_count,
      total_volume: agg.total_volume,
      avg_price,
      sentiment: toSentiment(avg_price),
      top_topic: agg.top_topic,
      price_change_24h,
    }
  })

  return NextResponse.json({
    sectors,
    total_volume: totalVolume,
    total_markets: totalMarkets,
    generated_at: new Date().toISOString(),
  } satisfies CategoriesResponse)
}
