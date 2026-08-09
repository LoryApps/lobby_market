import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/overdrive
 *
 * Topics where the argument community has gone FAR deeper than the voter count
 * would predict — debates with a high arguments-to-voters ratio. These are the
 * "intellectual black holes" where citizens don't just vote, they dig in and
 * fight with words.
 *
 * Score = total_arguments / max(total_votes, 1)
 *
 * Minimum threshold: 5+ votes, 3+ arguments.
 *
 * Distinct from:
 *   /api/feed/argued   — raw recent argument volume (last 24h count, not ratio)
 *   /vortex            — similar idea as standalone, but this is the feed version
 *   /api/feed/momentum — vote velocity, not argument depth
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "top" (highest ratio) | "new" | "hot" (most votes) (default "top")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  // Fetch topics with both total_votes and total_arguments populated
  const { data, error } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        role,
        clout
      )
    `)
    .in('status', ['proposed', 'active', 'voting'])
    .gte('total_votes', 5)
    .gte('total_arguments', 3)
    .order('total_arguments', { ascending: false })
    .limit(300)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as TopicWithAuthor[]

  // Compute overdrive ratio: arguments per voter
  const scored = rows
    .map((t) => ({
      ...t,
      _overdrive_ratio: (t.total_arguments ?? 0) / Math.max(t.total_votes ?? 1, 1),
      _overdrive_args: t.total_arguments ?? 0,
    }))
    .filter((t) => t._overdrive_ratio >= 0.05) // At least 1 arg per 20 voters

  // Sort
  if (sort === 'new') {
    scored.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (sort === 'hot') {
    scored.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
  } else {
    // top: highest ratio first, tie-break by total_arguments
    scored.sort((a, b) => {
      const diff = b._overdrive_ratio - a._overdrive_ratio
      if (Math.abs(diff) > 0.001) return diff > 0 ? 1 : -1
      return (b._overdrive_args ?? 0) - (a._overdrive_args ?? 0)
    })
  }

  const page = scored.slice(offset, offset + limit)
  const hasMore = scored.length > offset + limit

  return NextResponse.json({
    topics: page,
    hasMore,
    total: scored.length,
  })
}

// ── Type helpers ──────────────────────────────────────────────────────────────

interface AuthorProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

interface TopicWithAuthor {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  total_arguments: number
  blue_votes: number
  red_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  created_at: string
  updated_at: string
  author_id: string
  feed_score: number
  tags: string[] | null
  author: AuthorProfile | null
}
