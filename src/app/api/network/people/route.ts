import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NetworkPerson {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  bio: string | null
  vote_streak: number
  // Derived
  followed_at: string | null
  mutual: boolean
  is_following: boolean
}

export interface NetworkPeopleResponse {
  following: NetworkPerson[]
  followers: NetworkPerson[]
  suggestions: NetworkPerson[]
  following_count: number
  follower_count: number
  is_empty: boolean
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parallel fetch: who I follow, who follows me
  const [followingRes, followersRes] = await Promise.all([
    supabase
      .from('user_follows')
      .select('following_id, created_at')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('user_follows')
      .select('follower_id, created_at')
      .eq('following_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const followingIds = (followingRes.data ?? []).map((f) => f.following_id as string)
  const followerIds = (followersRes.data ?? []).map((f) => f.follower_id as string)

  // Build a set for mutual detection
  const followingSet = new Set(followingIds)
  const followerSet = new Set(followerIds)

  // Follow timestamp maps
  const followingTimestamps = new Map<string, string>()
  for (const f of followingRes.data ?? []) {
    followingTimestamps.set(f.following_id as string, f.created_at as string)
  }
  const followerTimestamps = new Map<string, string>()
  for (const f of followersRes.data ?? []) {
    followerTimestamps.set(f.follower_id as string, f.created_at as string)
  }

  const allIds = Array.from(new Set([...followingIds, ...followerIds]))

  // Fetch profiles for all relevant users
  const profilesMap = new Map<string, NetworkPerson>()
  if (allIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, bio, vote_streak'
      )
      .in('id', allIds)
      .limit(allIds.length + 5)

    for (const p of profiles ?? []) {
      profilesMap.set(p.id as string, {
        ...(p as NetworkPerson),
        followed_at: null,
        mutual: false,
        is_following: false,
      })
    }
  }

  // Build following list with context
  const following: NetworkPerson[] = followingIds
    .map((id) => {
      const p = profilesMap.get(id)
      if (!p) return null
      return {
        ...p,
        followed_at: followingTimestamps.get(id) ?? null,
        mutual: followerSet.has(id),
        is_following: true,
      }
    })
    .filter(Boolean) as NetworkPerson[]

  // Build followers list with context
  const followers: NetworkPerson[] = followerIds
    .map((id) => {
      const p = profilesMap.get(id)
      if (!p) return null
      return {
        ...p,
        followed_at: followerTimestamps.get(id) ?? null,
        mutual: followingSet.has(id),
        is_following: followingSet.has(id),
      }
    })
    .filter(Boolean) as NetworkPerson[]

  // Suggested people: not following, not the user, high reputation
  const excludeIds = [user.id, ...followingIds]
  let suggestions: NetworkPerson[] = []
  {
    const { data: suggestData } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, bio, vote_streak'
      )
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .gt('total_votes', 0)
      .order('reputation_score', { ascending: false })
      .limit(12)

    suggestions = (suggestData ?? []).map((p) => ({
      ...(p as NetworkPerson),
      followed_at: null,
      mutual: followerSet.has(p.id as string),
      is_following: false,
    }))
  }

  return NextResponse.json({
    following,
    followers,
    suggestions,
    following_count: followingIds.length,
    follower_count: followerIds.length,
    is_empty: followingIds.length === 0 && followerIds.length === 0,
  } satisfies NetworkPeopleResponse)
}
