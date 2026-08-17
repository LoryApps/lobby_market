import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface NetworkRelayActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkRelayTopic {
  id: string
  statement: string
  category: string | null
  status: string
}

export interface NetworkRelayItem {
  item_id: string        // unique key: relay_id + leg_id or relay_id for starters
  relay_id: string
  leg_id: string | null  // null for starters
  leg_number: number | null
  leg_content: string | null
  event_type: 'started' | 'contributed'
  occurred_at: string
  actor: NetworkRelayActor
  topic: NetworkRelayTopic
  relay_side: 'for' | 'against'
  relay_status: 'open' | 'in_progress' | 'complete' | 'voted'
  relay_leg_count: number
  relay_max_legs: number
  vote_compelling: number
  vote_not_compelling: number
}

export interface NetworkRelaysResponse {
  items: NetworkRelayItem[]
  following_count: number
  is_empty: boolean
  cursor: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 80)
  const cursor = searchParams.get('cursor') ?? null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
      items: [],
      following_count: 0,
      is_empty: true,
      cursor: null,
    } satisfies NetworkRelaysResponse)
  }

  // 2. Fetch relay legs contributed by followed users
  let legQuery = supabase
    .from('relay_legs')
    .select('id, relay_id, author_id, leg_number, content, created_at')
    .in('author_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    legQuery = legQuery.lt('created_at', cursor)
  }

  const { data: legs, error: legErr } = await legQuery

  if (legErr) {
    return NextResponse.json({ error: 'Failed to fetch relay legs' }, { status: 500 })
  }

  const legRows = legs ?? []
  const hasMore = legRows.length > limit
  const legSlice = hasMore ? legRows.slice(0, limit) : legRows
  const nextCursor = hasMore ? legSlice[legSlice.length - 1].created_at : null

  if (legSlice.length === 0) {
    return NextResponse.json({
      items: [],
      following_count: followingIds.length,
      is_empty: true,
      cursor: null,
    } satisfies NetworkRelaysResponse)
  }

  // 3. Fetch relay metadata for all referenced relays
  const relayIds = Array.from(new Set(legSlice.map((l) => l.relay_id as string)))
  const actorIds = Array.from(new Set(legSlice.map((l) => l.author_id as string)))

  const { data: relays } = await supabase
    .from('civic_relays')
    .select('id, topic_id, side, starter_id, status, max_legs, vote_compelling, vote_not_compelling')
    .in('id', relayIds)

  const relayMap = new Map<string, {
    topic_id: string | null
    side: string
    starter_id: string
    status: string
    max_legs: number
    vote_compelling: number
    vote_not_compelling: number
  }>()
  for (const r of relays ?? []) {
    relayMap.set(r.id, {
      topic_id: r.topic_id ?? null,
      side: r.side,
      starter_id: r.starter_id,
      status: r.status,
      max_legs: r.max_legs,
      vote_compelling: r.vote_compelling ?? 0,
      vote_not_compelling: r.vote_not_compelling ?? 0,
    })
  }

  // 4. Fetch leg counts per relay
  const { data: legCounts } = await supabase
    .from('relay_legs')
    .select('relay_id')
    .in('relay_id', relayIds)

  const legCountMap = new Map<string, number>()
  for (const lc of legCounts ?? []) {
    const rid = lc.relay_id as string
    legCountMap.set(rid, (legCountMap.get(rid) ?? 0) + 1)
  }

  // 5. Fetch topics
  const topicIds = Array.from(new Set(
    Array.from(relayMap.values()).map((r) => r.topic_id).filter(Boolean)
  ))

  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', topicIds)

  const topicMap = new Map<string, NetworkRelayTopic>()
  for (const t of topics ?? []) {
    topicMap.set(t.id, {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
    })
  }

  // 6. Fetch actor profiles
  const { data: actors } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', actorIds)

  const actorMap = new Map<string, NetworkRelayActor>()
  for (const a of actors ?? []) {
    actorMap.set(a.id, {
      id: a.id,
      username: a.username,
      display_name: a.display_name,
      avatar_url: a.avatar_url,
      role: a.role,
    })
  }

  // 7. Build result items
  const items: NetworkRelayItem[] = legSlice
    .map((leg) => {
      const relay = relayMap.get(leg.relay_id as string)
      if (!relay) return null
      const actor = actorMap.get(leg.author_id as string)
      if (!actor) return null
      const topic = relay.topic_id ? topicMap.get(relay.topic_id) : undefined
      if (!topic) return null

      const isStarter = relay.starter_id === leg.author_id
      const legCount = legCountMap.get(leg.relay_id as string) ?? 0

      return {
        item_id: `leg-${leg.id}`,
        relay_id: leg.relay_id as string,
        leg_id: leg.id as string,
        leg_number: leg.leg_number as number,
        leg_content: leg.content as string,
        event_type: isStarter ? 'started' : 'contributed',
        occurred_at: leg.created_at as string,
        actor,
        topic,
        relay_side: relay.side as 'for' | 'against',
        relay_status: relay.status as 'open' | 'in_progress' | 'complete' | 'voted',
        relay_leg_count: legCount,
        relay_max_legs: relay.max_legs ?? 5,
        vote_compelling: relay.vote_compelling,
        vote_not_compelling: relay.vote_not_compelling,
      } satisfies NetworkRelayItem
    })
    .filter((x): x is NetworkRelayItem => x !== null)

  return NextResponse.json({
    items,
    following_count: followingIds.length,
    is_empty: items.length === 0,
    cursor: nextCursor,
  } satisfies NetworkRelaysResponse)
}
