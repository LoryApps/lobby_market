import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/lastcall
 *
 * Topics in the Voting phase ordered by time remaining — soonest to expire
 * first. Surfaces the debates where a vote casts the most time-sensitive
 * impact. Only topics with a non-null voting_ends_at in the future.
 *
 * Query params:
 *   offset – pagination offset (default 0)
 *   limit  – page size (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')

  const supabase = await createClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('topics')
    .select(`
      id, statement, description, category, scope, status,
      blue_pct, total_votes, total_arguments, blue_votes, red_votes,
      support_count, activation_threshold, voting_ends_at,
      created_at, updated_at, author_id, feed_score, tags,
      author:profiles!topics_author_id_fkey (
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .eq('status', 'voting')
    .not('voting_ends_at', 'is', null)
    .gt('voting_ends_at', now)
    .order('voting_ends_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  const topics = data ?? []
  const hasMore = topics.length === limit

  return NextResponse.json(
    { topics, hasMore },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
