import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/users/suggestions?limit=10
 *
 * Returns high-reputation users that the current user isn't already following.
 * For unauthenticated users, returns top users by reputation.
 *
 * Response: { suggestions: SuggestedUser[] }
 */

export interface SuggestedUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  bio: string | null
}

export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '8', 10),
    20
  )

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let alreadyFollowingIds: string[] = []
  let currentUserId: string | null = null

  if (user) {
    currentUserId = user.id

    // Fetch who the user already follows
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .limit(500)

    alreadyFollowingIds = (follows ?? []).map((f) => f.following_id)
  }

  // Exclude current user and already-followed users
  const excludeIds = currentUserId
    ? [currentUserId, ...alreadyFollowingIds]
    : alreadyFollowingIds

  let query = supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, bio'
    )
    .order('reputation_score', { ascending: false })
    .limit(limit + excludeIds.length + 5) // over-fetch then filter

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  // Must have at least 1 vote to be suggested
  query = query.gt('total_votes', 0)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ suggestions: [] })
  }

  const suggestions = (data as SuggestedUser[]).slice(0, limit)

  return NextResponse.json({ suggestions })
}
