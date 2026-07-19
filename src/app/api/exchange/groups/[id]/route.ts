import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Market } from '@/app/api/exchange/route'

export const dynamic = 'force-dynamic'

export interface GroupMarket extends Market {
  added_at: string
}

export interface GroupDetail {
  id: string
  user_id: string
  name: string
  description: string | null
  emoji: string
  is_public: boolean
  item_count: number
  created_at: string
  updated_at: string
  is_owner: boolean
  owner_username: string | null
  owner_display_name: string | null
  markets: GroupMarket[]
  // Aggregate stats
  avg_price: number
  total_volume: number
  settled_count: number
  law_count: number
  failed_count: number
  live_count: number
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
    is_hot: false,
    is_closing_soon: isClosingSoon,
    is_near_law: price >= 75,
    is_deadlocked: price >= 45 && price <= 55,
  }
}

interface Props { params: { id: string } }

// GET — fetch a group with its markets and aggregate stats
export async function GET(_req: NextRequest, { params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: group, error: gErr } = await supabase
    .from('exchange_groups')
    .select(`
      id, user_id, name, description, emoji, is_public, item_count, created_at, updated_at,
      profiles:user_id ( username, display_name )
    `)
    .eq('id', params.id)
    .single()

  if (gErr || !group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = user?.id === (group.user_id as string)
  const isPublic = group.is_public as boolean
  if (!isOwner && !isPublic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch items + topic data
  const { data: items } = await supabase
    .from('exchange_group_items')
    .select(`added_at, topics:topic_id ( ${TOPIC_COLS} )`)
    .eq('group_id', params.id)
    .order('added_at', { ascending: false })
    .limit(100)

  const markets: GroupMarket[] = (items ?? []).map((item) => {
    const topic = (item as Record<string, unknown>).topics as Record<string, unknown> | null
    if (!topic) return null
    return { ...toMarket(topic), added_at: item.added_at as string }
  }).filter((m): m is GroupMarket => m !== null)

  // Aggregate stats
  const prices = markets.filter((m) => m.status !== 'law' && m.status !== 'failed').map((m) => m.price)
  const avg_price = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 50
  const total_volume = markets.reduce((acc, m) => acc + m.volume, 0)
  const law_count = markets.filter((m) => m.status === 'law').length
  const failed_count = markets.filter((m) => m.status === 'failed').length
  const settled_count = law_count + failed_count
  const live_count = markets.filter((m) => m.status === 'active' || m.status === 'voting').length

  const profile = (group as Record<string, unknown>).profiles as { username?: string; display_name?: string } | null

  const detail: GroupDetail = {
    id: group.id as string,
    user_id: group.user_id as string,
    name: group.name as string,
    description: group.description as string | null,
    emoji: (group.emoji as string) || '📊',
    is_public: isPublic,
    item_count: (group.item_count as number) ?? 0,
    created_at: group.created_at as string,
    updated_at: group.updated_at as string,
    is_owner: isOwner,
    owner_username: profile?.username ?? null,
    owner_display_name: profile?.display_name ?? null,
    markets,
    avg_price,
    total_volume,
    settled_count,
    law_count,
    failed_count,
    live_count,
  }

  return NextResponse.json(detail)
}

// PATCH — update group metadata
export async function PATCH(req: NextRequest, { params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    name?: string
    description?: string
    emoji?: string
    is_public?: boolean
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description.trim() || null
  if (body.emoji !== undefined) updates.emoji = body.emoji
  if (body.is_public !== undefined) updates.is_public = body.is_public

  const { data, error } = await supabase
    .from('exchange_groups')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, name, description, emoji, is_public, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// DELETE — remove a group
export async function DELETE(_req: NextRequest, { params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('exchange_groups')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
