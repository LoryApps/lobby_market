import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface NetworkCoalitionActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkCoalitionItem {
  join_id: string
  joined_at: string
  actor: NetworkCoalitionActor
  coalition: {
    id: string
    name: string
    description: string | null
    member_count: number
    coalition_influence: number
    wins: number
    losses: number
    is_public: boolean
    created_at: string
    creator: NetworkCoalitionActor | null
  }
  member_role: 'leader' | 'officer' | 'member'
}

export interface NetworkCoalitionsResponse {
  items: NetworkCoalitionItem[]
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
    } satisfies NetworkCoalitionsResponse)
  }

  // 2. Fetch recent coalition memberships by followed users
  let query = supabase
    .from('coalition_members')
    .select('id, user_id, coalition_id, role, joined_at')
    .in('user_id', followingIds)
    .order('joined_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('joined_at', cursor)
  }

  const { data: memberships, error: membErr } = await query

  if (membErr) {
    return NextResponse.json({ error: 'Failed to fetch memberships' }, { status: 500 })
  }

  const rows = memberships ?? []
  const hasMore = rows.length > limit
  const slice = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? slice[slice.length - 1].joined_at : null

  if (slice.length === 0) {
    return NextResponse.json({
      items: [],
      following_count: followingIds.length,
      is_empty: true,
      cursor: null,
    } satisfies NetworkCoalitionsResponse)
  }

  // 3. Fetch actor profiles
  const actorIds = Array.from(new Set(slice.map((r) => r.user_id as string)))
  const coalitionIds = Array.from(new Set(slice.map((r) => r.coalition_id as string)))

  const [{ data: actors }, { data: coalitions }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', actorIds),
    supabase
      .from('coalitions')
      .select('id, name, description, member_count, coalition_influence, wins, losses, is_public, created_at, creator_id')
      .in('id', coalitionIds),
  ])

  const actorMap = new Map<string, NetworkCoalitionActor>()
  for (const a of actors ?? []) {
    actorMap.set(a.id, {
      id: a.id,
      username: a.username,
      display_name: a.display_name,
      avatar_url: a.avatar_url,
      role: a.role,
    })
  }

  // Fetch coalition creators
  const creatorIds = Array.from(new Set((coalitions ?? []).map((c) => c.creator_id as string)))
  const extraCreatorIds = creatorIds.filter((id) => !actorMap.has(id))

  if (extraCreatorIds.length > 0) {
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', extraCreatorIds)
    for (const c of creators ?? []) {
      actorMap.set(c.id, {
        id: c.id,
        username: c.username,
        display_name: c.display_name,
        avatar_url: c.avatar_url,
        role: c.role,
      })
    }
  }

  const coalitionMap = new Map<string, (typeof coalitions extends null ? never : NonNullable<typeof coalitions>[number])>()
  for (const c of coalitions ?? []) {
    coalitionMap.set(c.id, c)
  }

  const items: NetworkCoalitionItem[] = slice
    .map((row) => {
      const actor = actorMap.get(row.user_id as string)
      const coalition = coalitionMap.get(row.coalition_id as string)
      if (!actor || !coalition) return null

      return {
        join_id: row.id as string,
        joined_at: row.joined_at as string,
        actor,
        coalition: {
          id: coalition.id,
          name: coalition.name,
          description: coalition.description,
          member_count: coalition.member_count,
          coalition_influence: coalition.coalition_influence,
          wins: coalition.wins,
          losses: coalition.losses,
          is_public: coalition.is_public,
          created_at: coalition.created_at,
          creator: actorMap.get(coalition.creator_id as string) ?? null,
        },
        member_role: row.role as 'leader' | 'officer' | 'member',
      } satisfies NetworkCoalitionItem
    })
    .filter((x): x is NetworkCoalitionItem => x !== null)

  return NextResponse.json({
    items,
    following_count: followingIds.length,
    is_empty: items.length === 0,
    cursor: nextCursor,
  } satisfies NetworkCoalitionsResponse)
}
