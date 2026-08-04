import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/argued
 *
 * Topics ranked by argument activity in the last 24 hours.
 * Surfaces debates where the intellectual contest is hottest right now —
 * distinct from "rising" (vote velocity) and "battleground" (vote split).
 *
 * Strategy:
 *   1. Count arguments posted per topic in the last 24h.
 *   2. Weight by unique authors (breadth > depth) and upvote totals.
 *   3. Fall back to topics with the most total arguments if 24h window is sparse.
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "top" (arg velocity) | "new" | "hot" (default "top")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // ── Step 1: Count recent arguments per topic ───────────────────────────────
  const { data: argCounts, error: argError } = await supabase
    .from('topic_arguments')
    .select('topic_id, user_id, upvotes, created_at')
    .gte('created_at', since24h)

  const topicArgMap = new Map<string, { count: number; authors: Set<string>; upvotes: number }>()

  if (!argError && argCounts) {
    for (const row of argCounts) {
      const existing = topicArgMap.get(row.topic_id)
      if (!existing) {
        topicArgMap.set(row.topic_id, {
          count: 1,
          authors: new Set([row.user_id]),
          upvotes: row.upvotes ?? 0,
        })
      } else {
        existing.count += 1
        existing.authors.add(row.user_id)
        existing.upvotes += row.upvotes ?? 0
      }
    }
  }

  // Compute a composite score: args + 0.5 * unique_authors + 0.1 * upvotes
  const scoredIds = Array.from(topicArgMap.entries())
    .map(([id, v]) => ({
      id,
      score: v.count + 0.5 * v.authors.size + 0.1 * v.upvotes,
      argCount: v.count,
      uniqueAuthors: v.authors.size,
      recentUpvotes: v.upvotes,
    }))
    .sort((a, b) => b.score - a.score)

  // ── Step 2: Fetch topic rows for the ranked IDs ───────────────────────────
  let topicData: TopicWithAuthor[] = []
  const metaMap = new Map(scoredIds.map((s) => [s.id, s]))

  if (scoredIds.length > 0) {
    const fetchIds = scoredIds.slice(0, Math.min(200, scoredIds.length)).map((s) => s.id)

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
      .in('id', fetchIds)
      .in('status', ['proposed', 'active', 'voting'])

    if (!error && data) {
      const idOrder = new Map(fetchIds.map((id, i) => [id, i]))
      topicData = (data as TopicWithAuthor[]).sort(
        (a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999)
      )
    }
  }

  // ── Step 3: Fallback — topics with highest total_arguments when 24h sparse ─
  if (topicData.length < 10) {
    const { data: fallback } = await supabase
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
      .gt('total_arguments', 0)
      .order('total_arguments', { ascending: false })
      .limit(60)

    if (fallback) {
      const existingIds = new Set(topicData.map((t) => t.id))
      const extras = (fallback as TopicWithAuthor[]).filter((t) => !existingIds.has(t.id))
      topicData = [...topicData, ...extras]
    }
  }

  // ── Step 4: Apply sort override and paginate ───────────────────────────────
  if (sort === 'new') {
    topicData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (sort === 'hot') {
    topicData.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
  }
  // "top" keeps the argument-activity score order from Step 2

  const page = topicData.slice(offset, offset + limit)
  const hasMore = topicData.length > offset + limit

  const topicsWithMeta = page.map((t) => ({
    ...t,
    _argued_count: metaMap.get(t.id)?.argCount ?? null,
    _argued_authors: metaMap.get(t.id)?.uniqueAuthors ?? null,
    _argued_upvotes: metaMap.get(t.id)?.recentUpvotes ?? null,
  }))

  return NextResponse.json({
    topics: topicsWithMeta,
    hasMore,
    total: topicData.length,
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
