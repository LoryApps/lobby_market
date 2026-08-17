import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkRelayLeg {
  id: string
  leg_number: number
  content: string
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface NetworkRelayItem {
  id: string
  side: 'for' | 'against'
  status: 'open' | 'in_progress' | 'complete' | 'voted'
  max_legs: number
  vote_compelling: number
  vote_not_compelling: number
  created_at: string
  completed_at: string | null
  starter: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
  legs: NetworkRelayLeg[]
  leg_count: number
}

export interface NetworkRelaysResponse {
  relays: NetworkRelayItem[]
  following_count: number
  is_empty: boolean
  cursor: string | null
}

// ─── GET /api/network/relays ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 40)
  const cursor = searchParams.get('cursor') ?? null

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch IDs of users this person follows
  const { data: follows, error: followErr } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (followErr) {
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 })
  }

  const followingIds = (follows ?? []).map((f) => f.following_id as string)

  if (followingIds.length === 0) {
    return NextResponse.json({
      relays: [],
      following_count: 0,
      is_empty: true,
      cursor: null,
    } satisfies NetworkRelaysResponse)
  }

  // 2. Fetch relays started by followed users
  let query = supabase
    .from('civic_relays')
    .select('id, topic_id, side, starter_id, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at')
    .in('starter_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: relayRows, error: relayErr } = await query

  if (relayErr) {
    return NextResponse.json({ error: 'Failed to fetch relays' }, { status: 500 })
  }

  const rows = relayRows ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null

  if (pageRows.length === 0) {
    return NextResponse.json({
      relays: [],
      following_count: followingIds.length,
      is_empty: true,
      cursor: null,
    } satisfies NetworkRelaysResponse)
  }

  // 3. Fetch starter profiles
  const starterIds = Array.from(new Set(pageRows.map((r) => r.starter_id as string)))
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', starterIds)

  const profileMap = new Map<string, NetworkRelayItem['starter']>()
  for (const p of profileRows ?? []) {
    profileMap.set(p.id, {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role ?? 'citizen',
    })
  }

  // 4. Fetch topic details
  const topicIds = Array.from(
    new Set(pageRows.map((r) => r.topic_id as string).filter(Boolean))
  )
  const topicMap = new Map<string, NonNullable<NetworkRelayItem['topic']>>()
  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)

    for (const t of topicRows ?? []) {
      topicMap.set(t.id, {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
      })
    }
  }

  // 5. Fetch legs for each relay
  const relayIds = pageRows.map((r) => r.id)
  const { data: legRows } = await supabase
    .from('relay_legs')
    .select('id, relay_id, author_id, leg_number, content, created_at')
    .in('relay_id', relayIds)
    .order('leg_number', { ascending: true })

  // 6. Fetch leg author profiles
  const legAuthorIds = Array.from(
    new Set((legRows ?? []).map((l) => l.author_id as string))
  )
  const legAuthorMap = new Map<string, NetworkRelayLeg['author']>()
  if (legAuthorIds.length > 0) {
    const { data: legProfileRows } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', legAuthorIds)

    for (const p of legProfileRows ?? []) {
      legAuthorMap.set(p.id, {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role ?? 'citizen',
      })
    }
  }

  // 7. Group legs by relay
  const legsByRelay = new Map<string, NetworkRelayLeg[]>()
  for (const leg of legRows ?? []) {
    const relayId = leg.relay_id as string
    if (!legsByRelay.has(relayId)) legsByRelay.set(relayId, [])
    legsByRelay.get(relayId)!.push({
      id: leg.id,
      leg_number: leg.leg_number,
      content: leg.content,
      created_at: leg.created_at,
      author: legAuthorMap.get(leg.author_id as string) ?? null,
    })
  }

  // 8. Build response
  const relays: NetworkRelayItem[] = []
  for (const row of pageRows) {
    const starter = profileMap.get(row.starter_id as string)
    if (!starter) continue

    const legs = legsByRelay.get(row.id) ?? []

    relays.push({
      id: row.id,
      side: row.side as 'for' | 'against',
      status: row.status as NetworkRelayItem['status'],
      max_legs: row.max_legs ?? 5,
      vote_compelling: row.vote_compelling ?? 0,
      vote_not_compelling: row.vote_not_compelling ?? 0,
      created_at: row.created_at,
      completed_at: row.completed_at ?? null,
      starter,
      topic: row.topic_id ? (topicMap.get(row.topic_id as string) ?? null) : null,
      legs,
      leg_count: legs.length,
    })
  }

  return NextResponse.json({
    relays,
    following_count: followingIds.length,
    is_empty: relays.length === 0,
    cursor: nextCursor,
  } satisfies NetworkRelaysResponse)
}
