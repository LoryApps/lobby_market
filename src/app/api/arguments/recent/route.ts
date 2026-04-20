import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RecentArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
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

export interface RecentArgumentsResponse {
  arguments: RecentArgument[]
  newest_at: string | null
}

/**
 * GET /api/arguments/recent
 *
 * Returns the most recent arguments platform-wide, for the Live feed.
 *
 * Query params:
 *   since   — ISO timestamp; only return arguments created after this time
 *   limit   — number of results (default 40, max 80)
 *   side    — 'for' | 'against' | 'all' (default 'all')
 *   category — category name or 'all' (default 'all')
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since')
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '40'), 80)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 40
  const side = searchParams.get('side') ?? 'all'
  const category = searchParams.get('category') ?? 'all'

  const supabase = await createClient()

  // Fetch recent arguments ordered by newest first
  let query = supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (since) {
    query = query.gt('created_at', since)
  }

  if (side === 'for') {
    query = query.eq('side', 'blue')
  } else if (side === 'against') {
    query = query.eq('side', 'red')
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      arguments: [],
      newest_at: null,
    } satisfies RecentArgumentsResponse)
  }

  // Collect unique user and topic IDs
  const userIdSet = new Set<string>()
  const topicIdSet = new Set<string>()
  for (const r of rows) {
    userIdSet.add(r.user_id)
    topicIdSet.add(r.topic_id)
  }
  const userIds = Array.from(userIdSet)
  const topicIds = Array.from(topicIdSet)

  const [authorsRes, topicsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds),
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds),
  ])

  const authorMap = new Map(
    (authorsRes.data ?? []).map((a) => [a.id, a])
  )
  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id, t])
  )

  let result: RecentArgument[] = rows.map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    side: row.side as 'blue' | 'red',
    content: row.content,
    upvotes: row.upvotes,
    created_at: row.created_at,
    author: authorMap.get(row.user_id) ?? null,
    topic: topicMap.get(row.topic_id) ?? null,
  }))

  // Filter by category after joining (cheaper than a subquery here)
  if (category !== 'all') {
    result = result.filter((a) => a.topic?.category === category)
  }

  const newest_at = result.length > 0 ? result[0].created_at : null

  return NextResponse.json({ arguments: result, newest_at } satisfies RecentArgumentsResponse)
}
