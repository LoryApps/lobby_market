import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface NetworkArgumentActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkArgumentTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface NetworkArgumentItem {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  argued_at: string
  actor: NetworkArgumentActor
  topic: NetworkArgumentTopic
}

export interface NetworkArgumentsResponse {
  arguments: NetworkArgumentItem[]
  following_count: number
  is_empty: boolean
  cursor: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 80)
  const cursor = searchParams.get('cursor') ?? null

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch IDs of users this person follows
  const { data: follows, error: followErr } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (followErr) {
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 })
  }

  const followingIds = (follows ?? []).map((f) => f.following_id as string)

  if (followingIds.length === 0) {
    return NextResponse.json({
      arguments: [],
      following_count: 0,
      is_empty: true,
      cursor: null,
    } satisfies NetworkArgumentsResponse)
  }

  // 2. Fetch recent arguments by followed users
  let query = supabase
    .from('topic_arguments')
    .select('id, user_id, topic_id, side, content, upvotes, created_at')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: argRows, error: argErr } = await query

  if (argErr) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const rows = argRows ?? []
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null

  if (pageRows.length === 0) {
    return NextResponse.json({
      arguments: [],
      following_count: followingIds.length,
      is_empty: true,
      cursor: null,
    } satisfies NetworkArgumentsResponse)
  }

  // 3. Fetch actor profiles
  const actorIds = Array.from(new Set(pageRows.map((r) => r.user_id as string)))
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', actorIds)

  const actorMap = new Map<string, NetworkArgumentActor>()
  for (const p of profileRows ?? []) {
    actorMap.set(p.id, {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role ?? 'citizen',
    })
  }

  // 4. Fetch topic details
  const topicIds = Array.from(new Set(pageRows.map((r) => r.topic_id as string)))
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  const topicMap = new Map<string, NetworkArgumentTopic>()
  for (const t of topicRows ?? []) {
    topicMap.set(t.id, {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
    })
  }

  // 5. Build response
  const args: NetworkArgumentItem[] = []
  for (const row of pageRows) {
    const actor = actorMap.get(row.user_id as string)
    const topic = topicMap.get(row.topic_id as string)
    if (!actor || !topic) continue

    args.push({
      id: row.id,
      side: row.side as 'blue' | 'red',
      content: row.content,
      upvotes: row.upvotes ?? 0,
      argued_at: row.created_at,
      actor,
      topic,
    })
  }

  return NextResponse.json({
    arguments: args,
    following_count: followingIds.length,
    is_empty: args.length === 0,
    cursor: nextCursor,
  } satisfies NetworkArgumentsResponse)
}
