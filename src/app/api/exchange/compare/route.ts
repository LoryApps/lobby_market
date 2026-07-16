import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompareMarketArg {
  id: string
  body: string
  side: 'for' | 'against'
  upvote_count: number
  author_username: string
  author_display_name: string | null
}

export interface CompareMarket {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  price: number
  price_label: string
  volume: number
  blue_votes: number
  red_votes: number
  voting_ends_at: string | null
  created_at: string
  feed_score: number
  // Stats
  price_high: number
  price_low: number
  price_open: number
  price_change_24h: number | null
  price_change_7d: number | null
  // Signals
  is_hot: boolean
  is_closing_soon: boolean
  is_near_law: boolean
  is_deadlocked: boolean
  // Arguments
  top_for: CompareMarketArg[]
  top_against: CompareMarketArg[]
}

export interface CompareResponse {
  a: CompareMarket
  b: CompareMarket
  // Computed comparisons
  higher_consensus: 'a' | 'b' | 'equal'
  higher_volume: 'a' | 'b' | 'equal'
  same_category: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOPIC_COLS = `
  id, statement, category, scope, status,
  blue_pct, blue_votes, red_votes, total_votes,
  feed_score, view_count, voting_ends_at, created_at
`.trim()

async function fetchMarket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<CompareMarket | null> {
  const { data: topic } = await supabase
    .from('topics')
    .select(TOPIC_COLS)
    .eq('id', id)
    .single()

  if (!topic) return null

  // Price history for stats
  const { data: history } = await supabase
    .from('topic_price_history')
    .select('price, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(300)

  const prices = (history ?? []).map((h) => h.price)
  const currentPrice = topic.blue_pct ?? 50

  const allPrices = prices.length > 0 ? prices : [currentPrice]
  const price_high = Math.max(...allPrices, currentPrice)
  const price_low = Math.min(...allPrices, currentPrice)
  const price_open = allPrices[0]

  const now = Date.now()
  const h24ago = now - 24 * 60 * 60 * 1000
  const d7ago = now - 7 * 24 * 60 * 60 * 1000

  const snap24 = history
    ? [...history].reverse().find((h) => new Date(h.recorded_at).getTime() <= h24ago)
    : null
  const snap7d = history
    ? [...history].reverse().find((h) => new Date(h.recorded_at).getTime() <= d7ago)
    : null

  const price_change_24h = snap24 ? currentPrice - snap24.price : null
  const price_change_7d = snap7d ? currentPrice - snap7d.price : null

  // Top arguments
  const [{ data: forArgs }, { data: againstArgs }] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select(`
        id, body, upvote_count,
        author:profiles!topic_arguments_author_id_fkey(username, display_name)
      `)
      .eq('topic_id', id)
      .eq('side', 'for')
      .order('upvote_count', { ascending: false })
      .limit(3),
    supabase
      .from('topic_arguments')
      .select(`
        id, body, upvote_count,
        author:profiles!topic_arguments_author_id_fkey(username, display_name)
      `)
      .eq('topic_id', id)
      .eq('side', 'against')
      .order('upvote_count', { ascending: false })
      .limit(3),
  ])

  function mapArg(r: Record<string, unknown>, side: 'for' | 'against'): CompareMarketArg {
    const author = (r.author as Record<string, unknown> | null) ?? {}
    return {
      id: r.id as string,
      body: r.body as string,
      side,
      upvote_count: (r.upvote_count as number) ?? 0,
      author_username: (author.username as string) ?? 'anonymous',
      author_display_name: (author.display_name as string | null) ?? null,
    }
  }

  const closingInMs = topic.voting_ends_at
    ? new Date(topic.voting_ends_at).getTime() - now
    : null

  return {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    scope: topic.scope ?? 'national',
    status: topic.status,
    price: currentPrice,
    price_label: `${Math.round(currentPrice)}¢`,
    volume: topic.total_votes ?? 0,
    blue_votes: topic.blue_votes ?? 0,
    red_votes: topic.red_votes ?? 0,
    voting_ends_at: topic.voting_ends_at,
    created_at: topic.created_at,
    feed_score: topic.feed_score ?? 0,
    price_high,
    price_low,
    price_open,
    price_change_24h,
    price_change_7d,
    is_hot: (topic.feed_score ?? 0) > 1000 || (topic.total_votes ?? 0) > 500,
    is_closing_soon:
      topic.status === 'voting' &&
      closingInMs !== null &&
      closingInMs > 0 &&
      closingInMs < 24 * 60 * 60 * 1000,
    is_near_law: topic.status === 'voting' && currentPrice >= 60,
    is_deadlocked: currentPrice >= 44 && currentPrice <= 56 && topic.status !== 'law' && topic.status !== 'failed',
    top_for: (forArgs ?? []).map((r) => mapArg(r as Record<string, unknown>, 'for')),
    top_against: (againstArgs ?? []).map((r) => mapArg(r as Record<string, unknown>, 'against')),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const aId = searchParams.get('a')
  const bId = searchParams.get('b')

  if (!aId || !bId) {
    return NextResponse.json({ error: 'Provide both ?a= and ?b= market IDs' }, { status: 400 })
  }

  const supabase = await createClient()

  const [a, b] = await Promise.all([
    fetchMarket(supabase, aId),
    fetchMarket(supabase, bId),
  ])

  if (!a) return NextResponse.json({ error: 'Market A not found' }, { status: 404 })
  if (!b) return NextResponse.json({ error: 'Market B not found' }, { status: 404 })

  const response: CompareResponse = {
    a,
    b,
    higher_consensus: a.price > b.price ? 'a' : a.price < b.price ? 'b' : 'equal',
    higher_volume: a.volume > b.volume ? 'a' : a.volume < b.volume ? 'b' : 'equal',
    same_category: a.category === b.category && a.category !== null,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  })
}
