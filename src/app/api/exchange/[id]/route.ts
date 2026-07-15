import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PriceSnapshot {
  price: number
  volume: number
  recorded_at: string
}

export interface MarketArgument {
  id: string
  body: string
  side: 'for' | 'against'
  upvote_count: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  created_at: string
}

export interface MarketDetail {
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
  updated_at: string
  feed_score: number
  view_count: number
  // Computed market signals
  is_hot: boolean
  is_closing_soon: boolean
  is_near_law: boolean
  is_deadlocked: boolean
  // Price history (oldest-first)
  history: PriceSnapshot[]
  // Stats
  price_high: number
  price_low: number
  price_open: number   // first ever snapshot
  price_change_24h: number | null
  price_change_7d: number | null
  // Top arguments
  top_for: MarketArgument[]
  top_against: MarketArgument[]
  // Related markets
  related: Array<{
    id: string
    statement: string
    price: number
    volume: number
    status: string
    category: string | null
  }>
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select(`
      id, statement, category, scope, status,
      blue_pct, blue_votes, red_votes, total_votes,
      feed_score, view_count, voting_ends_at,
      created_at, updated_at
    `)
    .eq('id', id)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── 2. Full price history ─────────────────────────────────────────────────
  const { data: rawHistory } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(500)

  const history: PriceSnapshot[] = rawHistory ?? []

  // If we have no history at all, seed a single point from current state
  if (history.length === 0) {
    history.push({
      price: topic.blue_pct ?? 50,
      volume: topic.total_votes ?? 0,
      recorded_at: topic.created_at,
    })
  }

  // ── 3. Computed price stats ───────────────────────────────────────────────
  const prices = history.map((h) => h.price)
  const price_high = Math.max(...prices, topic.blue_pct ?? 50)
  const price_low = Math.min(...prices, topic.blue_pct ?? 50)
  const price_open = history[0].price

  const now = Date.now()
  const h24ago = now - 24 * 60 * 60 * 1000
  const d7ago = now - 7 * 24 * 60 * 60 * 1000

  const snap24 = [...history].reverse().find(
    (h) => new Date(h.recorded_at).getTime() <= h24ago,
  )
  const snap7d = [...history].reverse().find(
    (h) => new Date(h.recorded_at).getTime() <= d7ago,
  )

  const currentPrice = topic.blue_pct ?? 50
  const price_change_24h = snap24 ? currentPrice - snap24.price : null
  const price_change_7d = snap7d ? currentPrice - snap7d.price : null

  // ── 4. Top arguments ──────────────────────────────────────────────────────
  const { data: forArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id, body, upvote_count, created_at,
      author:profiles!topic_arguments_author_id_fkey(
        username, display_name, avatar_url
      )
    `)
    .eq('topic_id', id)
    .eq('side', 'for')
    .order('upvote_count', { ascending: false })
    .limit(3)

  const { data: againstArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id, body, upvote_count, created_at,
      author:profiles!topic_arguments_author_id_fkey(
        username, display_name, avatar_url
      )
    `)
    .eq('topic_id', id)
    .eq('side', 'against')
    .order('upvote_count', { ascending: false })
    .limit(3)

  function mapArg(r: Record<string, unknown>, side: 'for' | 'against'): MarketArgument {
    const author = (r.author as Record<string, unknown> | null) ?? {}
    return {
      id: r.id as string,
      body: r.body as string,
      side,
      upvote_count: (r.upvote_count as number) ?? 0,
      author_username: (author.username as string) ?? 'anonymous',
      author_display_name: (author.display_name as string | null) ?? null,
      author_avatar_url: (author.avatar_url as string | null) ?? null,
      created_at: r.created_at as string,
    }
  }

  const top_for = (forArgs ?? []).map((r) => mapArg(r as Record<string, unknown>, 'for'))
  const top_against = (againstArgs ?? []).map((r) =>
    mapArg(r as Record<string, unknown>, 'against'),
  )

  // ── 5. Related markets ────────────────────────────────────────────────────
  const { data: relatedRows } = await supabase
    .from('topics')
    .select('id, statement, blue_pct, total_votes, status, category')
    .eq('category', topic.category ?? '')
    .neq('id', id)
    .neq('status', 'proposed')
    .order('feed_score', { ascending: false })
    .limit(4)

  const related = (relatedRows ?? []).map((r) => ({
    id: r.id as string,
    statement: r.statement as string,
    price: (r.blue_pct as number) ?? 50,
    volume: (r.total_votes as number) ?? 0,
    status: r.status as string,
    category: (r.category as string | null) ?? null,
  }))

  // ── 6. Compute signals ────────────────────────────────────────────────────
  const closingInMs = topic.voting_ends_at
    ? new Date(topic.voting_ends_at).getTime() - now
    : null

  const detail: MarketDetail = {
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
    updated_at: topic.updated_at ?? topic.created_at,
    feed_score: topic.feed_score ?? 0,
    view_count: topic.view_count ?? 0,
    is_hot: (topic.feed_score ?? 0) > 1000 || (topic.total_votes ?? 0) > 500,
    is_closing_soon:
      topic.status === 'voting' &&
      closingInMs !== null &&
      closingInMs > 0 &&
      closingInMs < 24 * 60 * 60 * 1000,
    is_near_law: topic.status === 'voting' && currentPrice >= 60,
    is_deadlocked:
      currentPrice >= 44 &&
      currentPrice <= 56 &&
      topic.status !== 'law' &&
      topic.status !== 'failed',
    history,
    price_high,
    price_low,
    price_open,
    price_change_24h,
    price_change_7d,
    top_for,
    top_against,
    related,
  }

  return NextResponse.json(detail, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  })
}
