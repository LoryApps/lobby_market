import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Market } from '@/app/api/exchange/route'

export const dynamic = 'force-dynamic'

export interface WatchlistItem {
  id: string
  topic_id: string
  note: string | null
  created_at: string
  market: Market
}

export interface WatchlistResponse {
  items: WatchlistItem[]
  total: number
}

const TOPIC_COLS = `
  id, statement, category, scope, status,
  blue_pct, total_votes, feed_score, view_count,
  voting_ends_at, created_at, updated_at
`.trim()

function toMarket(row: Record<string, unknown>): Market {
  const price = Math.round((row.blue_pct as number) ?? 50)
  const votes = (row.total_votes as number) ?? 0
  const status = row.status as string
  const votingEndsAt = row.voting_ends_at as string | null

  let marketStatus: Market['market_status'] = 'pending'
  if (status === 'law') marketStatus = 'settled_yes'
  else if (status === 'failed') marketStatus = 'settled_no'
  else if (status === 'voting') marketStatus = 'voting'
  else if (status === 'active') marketStatus = 'live'

  let priceLabel = `${price}¢`
  if (status === 'law') priceLabel = 'LAW ✓'
  else if (status === 'failed') priceLabel = 'FAILED ✗'

  const isClosingSoon =
    status === 'voting' &&
    votingEndsAt !== null &&
    new Date(votingEndsAt).getTime() - Date.now() < 86_400_000

  return {
    id: row.id as string,
    statement: row.statement as string,
    category: row.category as string | null,
    scope: row.scope as string,
    status,
    price,
    price_label: priceLabel,
    volume: votes,
    voting_ends_at: votingEndsAt,
    feed_score: (row.feed_score as number) ?? 0,
    view_count: (row.view_count as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    market_status: marketStatus,
    is_hot: ((row.feed_score as number) ?? 0) > 50,
    is_closing_soon: isClosingSoon,
    is_near_law: price >= 75,
    is_deadlocked: price >= 45 && price <= 55,
  }
}

// GET — list the current user's watchlist
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('exchange_watchlist')
    .select(`
      id,
      topic_id,
      note,
      created_at,
      topics ( ${TOPIC_COLS} )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items: WatchlistItem[] = (data ?? []).map((row) => {
    const topic = (row as Record<string, unknown>).topics as Record<string, unknown> | null
    return {
      id: row.id as string,
      topic_id: row.topic_id as string,
      note: row.note as string | null,
      created_at: row.created_at as string,
      market: topic ? toMarket(topic) : ({} as Market),
    }
  }).filter((item) => item.market.id)

  return NextResponse.json({ items, total: items.length } satisfies WatchlistResponse)
}

// POST — add a market to the watchlist
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { topic_id?: string; note?: string }
  const { topic_id, note } = body

  if (!topic_id) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('exchange_watchlist')
    .upsert(
      { user_id: user.id, topic_id, note: note ?? null },
      { onConflict: 'user_id,topic_id', ignoreDuplicates: false }
    )
    .select('id, topic_id, note, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — remove a market from the watchlist (?topic_id=xxx)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const topicId = new URL(req.url).searchParams.get('topic_id')
  if (!topicId) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const { error } = await supabase
    .from('exchange_watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('topic_id', topicId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
