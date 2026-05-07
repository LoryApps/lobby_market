import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/tags
 *
 * Returns paginated topics whose tags overlap with the current user's
 * followed tags. Requires authentication.
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "top" | "new" | "hot" (default "new")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
  const sort = searchParams.get('sort') || 'new'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Fetch the user's followed tags
  const { data: followRows, error: followError } = await supabase
    .from('user_tag_follows')
    .select('tag')
    .eq('user_id', user.id)

  if (followError) {
    return NextResponse.json({ error: 'Failed to fetch tag follows' }, { status: 500 })
  }

  const followedTags = (followRows ?? []).map((r) => r.tag as string)

  if (followedTags.length === 0) {
    return NextResponse.json({ topics: [], followedTags: [], followedTagCount: 0 })
  }

  // 2. Fetch topics that contain at least one of the followed tags
  //    Using the Postgres overlap operator via .overlaps() — topics.tags && followedTags
  let query = supabase
    .from('topics')
    .select('*, author:profiles!author_id(id, username, display_name, avatar_url, role)')
    .overlaps('tags', followedTags)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .range(offset, offset + limit - 1)

  if (sort === 'hot') {
    query = query.order('view_count', { ascending: false }).order('created_at', { ascending: false })
  } else if (sort === 'top') {
    query = query.order('feed_score', { ascending: false }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch tag feed' }, { status: 500 })
  }

  return NextResponse.json({
    topics: data ?? [],
    followedTags,
    followedTagCount: followedTags.length,
  })
}
