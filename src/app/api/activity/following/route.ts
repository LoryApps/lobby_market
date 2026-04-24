import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NetworkEventType =
  | 'topic_proposed'
  | 'topic_active'
  | 'topic_voting'
  | 'law_established'
  | 'argument_posted'

export interface NetworkActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkTopicRef {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface NetworkEvent {
  id: string
  type: NetworkEventType
  timestamp: string
  actor: NetworkActor
  topic: NetworkTopicRef
  argument?: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
  } | null
}

export interface NetworkFeedResponse {
  events: NetworkEvent[]
  followingCount: number
  isEmpty: boolean
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 80)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Get the IDs of users this person follows
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
      events: [],
      followingCount: 0,
      isEmpty: true,
    } satisfies NetworkFeedResponse)
  }

  // 2. Fetch profiles for followed users (actor data)
  const { data: actorRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', followingIds)

  const actorMap = new Map<string, NetworkActor>()
  for (const p of actorRows ?? []) {
    actorMap.set(p.id, {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
    })
  }

  // 3. Parallel: recent topics + recent arguments by followed users
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [topicsRes, argsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, author_id, created_at, updated_at')
      .in('author_id', followingIds)
      .in('status', ['proposed', 'active', 'voting', 'law'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabase
      .from('topic_arguments')
      .select('id, topic_id, user_id, side, content, upvotes, created_at')
      .in('user_id', followingIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  // 4. For arguments, fetch the associated topics
  const argTopicIdSet = new Set((argsRes.data ?? []).map((a) => a.topic_id as string))
  const argTopicIds = Array.from(argTopicIdSet)
  const topicMap = new Map<string, NetworkTopicRef>()

  // Add topics from the topics fetch
  for (const t of topicsRes.data ?? []) {
    topicMap.set(t.id, {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
    })
  }

  // Fetch any argument topics not already in the map
  const missingTopicIds = argTopicIds.filter((id) => !topicMap.has(id))
  if (missingTopicIds.length > 0) {
    const { data: extraTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', missingTopicIds)
    for (const t of extraTopics ?? []) {
      topicMap.set(t.id, {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
      })
    }
  }

  // 5. Build merged, time-sorted event list
  const events: NetworkEvent[] = []

  for (const topic of topicsRes.data ?? []) {
    const actor = actorMap.get(topic.author_id as string)
    if (!actor) continue

    let type: NetworkEventType = 'topic_proposed'
    if (topic.status === 'law') type = 'law_established'
    else if (topic.status === 'voting') type = 'topic_voting'
    else if (topic.status === 'active') type = 'topic_active'

    const timestamp =
      type === 'law_established' || type === 'topic_voting'
        ? ((topic.updated_at as string | null) ?? topic.created_at)
        : topic.created_at

    events.push({
      id: `topic-${topic.id}`,
      type,
      timestamp,
      actor,
      topic: topicMap.get(topic.id) ?? {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes ?? 0,
      },
    })
  }

  for (const arg of argsRes.data ?? []) {
    const actor = actorMap.get(arg.user_id as string)
    const topic = topicMap.get(arg.topic_id as string)
    if (!actor || !topic) continue

    events.push({
      id: `arg-${arg.id}`,
      type: 'argument_posted',
      timestamp: arg.created_at,
      actor,
      topic,
      argument: {
        id: arg.id,
        content: arg.content,
        side: arg.side as 'blue' | 'red',
        upvotes: arg.upvotes ?? 0,
      },
    })
  }

  // Sort by timestamp descending, keep top N
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({
    events: events.slice(0, limit),
    followingCount: followingIds.length,
    isEmpty: events.length === 0,
  } satisfies NetworkFeedResponse)
}
