import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReelArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  ai_score: number | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface ReelResponse {
  arguments: ReelArgument[]
  cursor: string | null
  source: 'personalized' | 'trending'
  user_upvoted_ids: string[]
  user_bookmarked_ids: string[]
}

const VALID_FILTERS = ['all', 'for', 'against'] as const
type Filter = (typeof VALID_FILTERS)[number]

/**
 * GET /api/reel
 *
 * Returns a mixed feed of high-quality arguments for the Civic Reel.
 *
 * Query params:
 *   cursor   — ISO timestamp for pagination (load older)
 *   filter   — 'all' | 'for' | 'against' (default: 'all')
 *   limit    — number of items (default 20, max 40)
 *   category — topic category filter (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawFilter = searchParams.get('filter') ?? 'all'
  const filter: Filter = VALID_FILTERS.includes(rawFilter as Filter)
    ? (rawFilter as Filter)
    : 'all'
  const cursor = searchParams.get('cursor')
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = Math.min(40, Math.max(5, isNaN(rawLimit) ? 20 : rawLimit))
  const category = searchParams.get('category') ?? ''

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Build query ─────────────────────────────────────────────────────────────
  let query = supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, reply_count, ai_score, created_at')
    .gte('upvotes', 0)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })

  if (filter === 'for') query = query.eq('side', 'blue')
  if (filter === 'against') query = query.eq('side', 'red')
  if (cursor) query = query.lt('created_at', cursor)

  const { data: rows, error } = await query.limit(limit + 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const hasMore = (rows ?? []).length > limit
  const items = hasMore ? (rows ?? []).slice(0, limit) : (rows ?? [])

  if (items.length === 0) {
    return NextResponse.json({
      arguments: [],
      cursor: null,
      source: 'trending',
      user_upvoted_ids: [],
      user_bookmarked_ids: [],
    } satisfies ReelResponse)
  }

  // ── Collect IDs ─────────────────────────────────────────────────────────────
  const userIdSet = new Set(items.map((r) => r.user_id))
  const topicIdSet = new Set(items.map((r) => r.topic_id))
  const argIds = items.map((r) => r.id)

  // ── Parallel fetch ──────────────────────────────────────────────────────────
  const [authorsRes, topicsRes, upvotedRes, bookmarkedRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', Array.from(userIdSet)),
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', Array.from(topicIdSet)),
    user
      ? supabase
          .from('topic_argument_votes')
          .select('argument_id')
          .eq('user_id', user.id)
          .in('argument_id', argIds)
      : Promise.resolve({ data: [] }),
    user
      ? supabase
          .from('argument_bookmarks')
          .select('argument_id')
          .eq('user_id', user.id)
          .in('argument_id', argIds)
      : Promise.resolve({ data: [] }),
  ])

  const authorMap = new Map(
    (authorsRes.data ?? []).map((a) => [a.id, a])
  )
  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id, t])
  )

  // Filter by category if requested
  let filtered = items
  if (category) {
    filtered = items.filter((r) => topicMap.get(r.topic_id)?.category === category)
  }

  const arguments_: ReelArgument[] = filtered.map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    side: row.side as 'blue' | 'red',
    content: row.content,
    upvotes: row.upvotes,
    reply_count: (row as { reply_count?: number }).reply_count ?? 0,
    ai_score: (row as { ai_score?: number | null }).ai_score ?? null,
    created_at: row.created_at,
    author: authorMap.get(row.user_id) ?? null,
    topic: topicMap.get(row.topic_id) ?? null,
  }))

  const newCursor = hasMore && filtered.length > 0
    ? filtered[filtered.length - 1].created_at
    : null

  return NextResponse.json({
    arguments: arguments_,
    cursor: newCursor,
    source: user ? 'personalized' : 'trending',
    user_upvoted_ids: (upvotedRes.data ?? []).map(
      (r) => (r as { argument_id: string }).argument_id
    ),
    user_bookmarked_ids: (bookmarkedRes.data ?? []).map(
      (r) => (r as { argument_id: string }).argument_id
    ),
  } satisfies ReelResponse)
}
