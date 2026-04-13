import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/feed/following
 *
 * Returns paginated topics authored by users the current user follows.
 * Guests (unauthenticated) get a 401.
 * Authenticated users who follow nobody get an empty array.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
  const sort = searchParams.get('sort') || 'new'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch the list of user IDs this user follows
  const { data: follows, error: followError } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (followError) {
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 })
  }

  const followingIds = (follows ?? []).map((f) => f.following_id as string)

  // No follows → return empty feed immediately (saves a DB round-trip)
  if (followingIds.length === 0) {
    return NextResponse.json({ topics: [], followingCount: 0 })
  }

  // 2. Fetch topics authored by followed users (live statuses only)
  let query = supabase
    .from('topics')
    .select('*')
    .in('author_id', followingIds)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .range(offset, offset + limit - 1)

  if (sort === 'hot') {
    query = query
      .order('total_votes', { ascending: false })
      .order('created_at', { ascending: false })
  } else if (sort === 'top') {
    query = query
      .order('feed_score', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    // new (default for following feed)
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch following feed' }, { status: 500 })
  }

  return NextResponse.json({ topics: data ?? [], followingCount: followingIds.length })
}
