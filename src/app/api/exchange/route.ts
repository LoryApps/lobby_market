import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type MarketStatus = 'live' | 'voting' | 'settled_yes' | 'settled_no' | 'pending'

export interface Market {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  // Market price = probability of becoming law (0–100)
  price: number
  price_label: string
  // Volume = total votes cast
  volume: number
  // Settlement info
  voting_ends_at: string | null
  // Activity signal
  feed_score: number
  view_count: number
  created_at: string
  updated_at: string
  market_status: MarketStatus
  // Computed signals
  is_hot: boolean
  is_closing_soon: boolean
  is_near_law: boolean
  is_deadlocked: boolean
}

export interface ExchangeStats {
  total_volume: number
  live_markets: number
  voting_markets: number
  laws_today: number
  biggest_mover_id: string | null
  biggest_mover_label: string | null
}

export interface ExchangeResponse {
  markets: Market[]
  stats: ExchangeStats
  sort: string
  category: string | null
}

function toMarketStatus(status: string, _voting_ends_at: string | null): MarketStatus {
  if (status === 'law') return 'settled_yes'
  if (status === 'failed') return 'settled_no'
  if (status === 'voting') return 'voting'
  if (status === 'active') return 'live'
  return 'pending'
}

const TOPIC_COLS = `
  id, statement, category, scope, status,
  blue_pct, blue_votes, red_votes, total_votes,
  feed_score, view_count, voting_ends_at,
  created_at, updated_at
`.trim()

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const sort = searchParams.get('sort') || 'volume'
  const category = searchParams.get('category') || null
  const statusFilter = searchParams.get('status') || null

  let query = supabase
    .from('topics')
    .select(TOPIC_COLS)
    .neq('status', 'proposed')

  if (category) query = query.eq('category', category)

  if (statusFilter === 'live') query = query.eq('status', 'active')
  else if (statusFilter === 'voting') query = query.eq('status', 'voting')
  else if (statusFilter === 'settled') query = query.in('status', ['law', 'failed'])

  switch (sort) {
    case 'volume':
      query = query.order('total_votes', { ascending: false })
      break
    case 'contested':
      // Closest to 50/50 deadlock
      query = query.order('blue_pct', { ascending: true }).limit(200)
      break
    case 'momentum':
      query = query.order('feed_score', { ascending: false })
      break
    case 'closing':
      query = query
        .eq('status', 'voting')
        .not('voting_ends_at', 'is', null)
        .order('voting_ends_at', { ascending: true })
      break
    case 'near_law':
      query = query
        .eq('status', 'voting')
        .gte('blue_pct', 55)
        .order('blue_pct', { ascending: false })
      break
    default:
      query = query.order('total_votes', { ascending: false })
  }

  query = query.limit(100)

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = Date.now()

  let markets: Market[] = (rows ?? []).map((r) => {
    const price = r.blue_pct ?? 50
    const market_status = toMarketStatus(r.status, r.voting_ends_at)

    const closing_in_ms = r.voting_ends_at
      ? new Date(r.voting_ends_at).getTime() - now
      : null

    const is_closing_soon =
      r.status === 'voting' &&
      closing_in_ms !== null &&
      closing_in_ms > 0 &&
      closing_in_ms < 24 * 60 * 60 * 1000

    return {
      id: r.id,
      statement: r.statement,
      category: r.category,
      scope: r.scope,
      status: r.status,
      price,
      price_label: `${Math.round(price)}¢`,
      volume: r.total_votes ?? 0,
      voting_ends_at: r.voting_ends_at,
      feed_score: r.feed_score ?? 0,
      view_count: r.view_count ?? 0,
      created_at: r.created_at,
      updated_at: r.updated_at ?? r.created_at,
      market_status,
      is_hot: (r.feed_score ?? 0) > 1000 || (r.total_votes ?? 0) > 500,
      is_closing_soon,
      is_near_law: r.status === 'voting' && price >= 60,
      is_deadlocked: price >= 44 && price <= 56 && r.status !== 'law' && r.status !== 'failed',
    }
  })

  // For 'contested' sort: re-sort by distance from 50 after query
  if (sort === 'contested') {
    markets = markets.sort((a, b) => Math.abs(a.price - 50) - Math.abs(b.price - 50)).slice(0, 60)
  }

  // Stats aggregation
  const allActive = markets.filter((m) => m.status === 'active' || m.status === 'voting')
  const total_volume = (rows ?? []).reduce((s, r) => s + (r.total_votes ?? 0), 0)
  const live_markets = markets.filter((m) => m.status === 'active').length
  const voting_markets = markets.filter((m) => m.status === 'voting').length

  // Laws settled today
  const today_start = new Date()
  today_start.setHours(0, 0, 0, 0)
  const laws_today = markets.filter(
    (m) => m.status === 'law' && new Date(m.updated_at) >= today_start,
  ).length

  // Biggest mover = highest feed_score among live markets
  const topMover = allActive.sort((a, b) => b.feed_score - a.feed_score)[0] ?? null

  const stats: ExchangeStats = {
    total_volume,
    live_markets,
    voting_markets,
    laws_today,
    biggest_mover_id: topMover?.id ?? null,
    biggest_mover_label: topMover?.statement ?? null,
  }

  return NextResponse.json({ markets, stats, sort, category } satisfies ExchangeResponse)
}
