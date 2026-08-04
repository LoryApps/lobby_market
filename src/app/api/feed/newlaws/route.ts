import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/newlaws
 *
 * Recently established laws, sorted by when they passed. Lets users
 * celebrate the results of the democratic process and see which debates
 * resolved into law. Joins `laws` for `established_at` so ordering is
 * by exact passage time rather than topic update time.
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "top" (most votes) | "new" (newest law, default) | "hot" (most votes)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'new'

  const supabase = await createClient()

  // Fetch laws table for established_at ordering, join with topics for card data
  const { data: lawRows, error } = await supabase
    .from('laws')
    .select(`
      established_at,
      topic_id,
      topics!inner(
        id,
        statement,
        description,
        category,
        scope,
        status,
        blue_pct,
        total_votes,
        blue_votes,
        red_votes,
        support_count,
        activation_threshold,
        voting_ends_at,
        created_at,
        updated_at,
        author_id,
        feed_score,
        tags,
        author:profiles!topics_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          role,
          clout
        )
      )
    `)
    .eq('is_active', true)
    .range(offset, offset + limit - 1)
    .order(
      sort === 'top' ? 'total_votes' : sort === 'hot' ? 'total_votes' : 'established_at',
      { ascending: false }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Unwrap the nested topics shape into flat TopicWithAuthor objects
  const topics = (lawRows ?? []).map((row) => {
    const topic = (row as Record<string, unknown>).topics as Record<string, unknown>
    return {
      ...topic,
      // Inject established_at so the feed card can show "Passed X ago"
      established_at: row.established_at,
    }
  })

  return NextResponse.json({ topics })
}
