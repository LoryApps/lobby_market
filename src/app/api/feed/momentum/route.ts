import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/momentum
 *
 * Topics ranked by raw vote velocity — the most votes cast in the last 2 hours.
 * Surfaces topics with the highest civic energy right now, regardless of which
 * side is winning.
 *
 * Distinct from:
 *   /flux      — consensus shift (changing minds)
 *   /rising    — new users joining
 *   /battleground — contested split
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

  const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  // Fetch votes in last 2 hours
  const { data: recentVotes, error: votesError } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', since2h)
    .limit(50000)

  if (votesError) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  const votes = recentVotes ?? []

  if (votes.length === 0) {
    // Fallback: return high-activity topics by total_votes
    const { data: fallback } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({ topics: fallback ?? [], hasMore: (fallback?.length ?? 0) >= limit })
  }

  // Count votes per topic
  const voteCount = new Map<string, number>()
  for (const v of votes) {
    voteCount.set(v.topic_id, (voteCount.get(v.topic_id) ?? 0) + 1)
  }

  // Sort by velocity descending
  const sorted = [...voteCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(offset, offset + limit)

  if (sorted.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  const topicIds = sorted.map(([id]) => id)

  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .in('id', topicIds)

  if (topicsError) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  // Re-apply velocity sort order and inject vote count
  const topicsById = new Map((topicsData ?? []).map((t) => [t.id, t]))
  const topics = sorted
    .map(([id, velocity]) => {
      const t = topicsById.get(id)
      if (!t) return null
      return { ...t, _momentum_votes: velocity }
    })
    .filter(Boolean)

  const hasMore = voteCount.size > offset + limit

  return NextResponse.json({ topics, hasMore })
}
