import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 20

export interface FollowerEntry {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: 'person' | 'debator' | 'troll_catcher' | 'elder'
  clout: number
  isFollowing: boolean
}

/**
 * GET /api/profile/[username]/followers?type=followers|following&cursor=<created_at>
 * Returns a paginated list of followers or following for the given username.
 * isFollowing reflects whether the *current viewer* follows each listed user.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()
  const url = req.nextUrl
  const type = (url.searchParams.get('type') ?? 'followers') as
    | 'followers'
    | 'following'
  const cursor = url.searchParams.get('cursor')

  // Resolve username → id
  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', params.username)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Current viewer (for isFollowing check)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userIds: string[] = []
  let nextCursorValue: string | null = null

  if (type === 'followers') {
    // People who follow this profile
    let q = supabase
      .from('user_follows')
      .select('follower_id, created_at')
      .eq('following_id', target.id)
      .order('created_at', { ascending: false })

    if (cursor) q = q.lt('created_at', cursor)

    const { data: rows } = await q.limit(PAGE_SIZE + 1)
    const all = rows ?? []

    if (all.length > PAGE_SIZE) {
      all.pop()
      nextCursorValue = all[all.length - 1]?.created_at ?? null
    }
    userIds = all.map((r) => r.follower_id)
  } else {
    // People this profile follows
    let q = supabase
      .from('user_follows')
      .select('following_id, created_at')
      .eq('follower_id', target.id)
      .order('created_at', { ascending: false })

    if (cursor) q = q.lt('created_at', cursor)

    const { data: rows } = await q.limit(PAGE_SIZE + 1)
    const all = rows ?? []

    if (all.length > PAGE_SIZE) {
      all.pop()
      nextCursorValue = all[all.length - 1]?.created_at ?? null
    }
    userIds = all.map((r) => r.following_id)
  }

  if (userIds.length === 0) {
    return NextResponse.json({ users: [], nextCursor: null })
  }

  // Fetch profile data for those users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', userIds)

  // Check which of those users the current viewer already follows
  let followingSet = new Set<string>()
  if (user) {
    const { data: myFollows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', userIds)
    followingSet = new Set((myFollows ?? []).map((f) => f.following_id))
  }

  // Preserve the order returned by the follow-relation query
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const users: FollowerEntry[] = []
  for (const id of userIds) {
    const p = profileMap.get(id)
    if (!p) continue
    users.push({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      clout: p.clout,
      isFollowing: followingSet.has(p.id),
    })
  }

  return NextResponse.json({ users, nextCursor: nextCursorValue })
}
