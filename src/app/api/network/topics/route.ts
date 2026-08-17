import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type NetworkTopicRelation = 'voted' | 'proposed' | 'argued'

export interface NetworkTopicActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkTopicItem {
  /** Dedup key — one entry per (actor, topic) pair */
  key: string
  relation: NetworkTopicRelation
  vote_side?: 'blue' | 'red'
  acted_at: string
  actor: NetworkTopicActor
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    view_count: number
  }
}

export interface NetworkTopicsResponse {
  items: NetworkTopicItem[]
  following_count: number
  is_empty: boolean
}

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

  // 1. Who does this user follow?
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
      items: [],
      following_count: 0,
      is_empty: true,
    } satisfies NetworkTopicsResponse)
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 2. Fetch signal types in parallel
  // Note: topic_bookmarks has RLS (user can only see their own), so we skip it.
  const [voteRes, proposalRes, argumentRes] = await Promise.all([
    supabase
      .from('votes')
      .select('id, user_id, topic_id, side, created_at')
      .in('user_id', followingIds)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabase
      .from('topics')
      .select('id, creator_id, created_at')
      .in('creator_id', followingIds)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabase
      .from('topic_arguments')
      .select('id, user_id, topic_id, created_at')
      .in('user_id', followingIds)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  // 3. Collect unique actor IDs and topic IDs
  type RawEvent = {
    key: string
    relation: NetworkTopicRelation
    vote_side?: 'blue' | 'red'
    acted_at: string
    actor_id: string
    topic_id: string
  }

  const rawEvents: RawEvent[] = []
  const seen = new Set<string>()

  function add(
    relation: NetworkTopicRelation,
    actor_id: string,
    topic_id: string,
    acted_at: string,
    vote_side?: 'blue' | 'red',
  ) {
    const key = `${actor_id}:${topic_id}:${relation}`
    if (seen.has(key)) return
    seen.add(key)
    rawEvents.push({ key, relation, vote_side, acted_at, actor_id, topic_id })
  }

  for (const r of voteRes.data ?? []) {
    add('voted', r.user_id as string, r.topic_id as string, r.created_at, r.side as 'blue' | 'red')
  }
  for (const r of proposalRes.data ?? []) {
    add('proposed', r.creator_id as string, r.id, r.created_at)
  }
  for (const r of argumentRes.data ?? []) {
    add('argued', r.user_id as string, r.topic_id as string, r.created_at)
  }

  // Sort merged events newest first, cap at limit
  rawEvents.sort((a, b) => b.acted_at.localeCompare(a.acted_at))
  const page = rawEvents.slice(0, limit)

  if (page.length === 0) {
    return NextResponse.json({
      items: [],
      following_count: followingIds.length,
      is_empty: true,
    } satisfies NetworkTopicsResponse)
  }

  // 4. Batch-fetch profiles and topics
  const actorIds = Array.from(new Set(page.map((e) => e.actor_id)))
  const topicIds = Array.from(new Set(page.map((e) => e.topic_id)))

  const [profileRes, topicRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', actorIds),

    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count')
      .in('id', topicIds),
  ])

  const actorMap = new Map<string, NetworkTopicActor>()
  for (const p of profileRes.data ?? []) {
    actorMap.set(p.id, {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role ?? 'citizen',
    })
  }

  const topicMap = new Map<
    string,
    { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number; view_count: number }
  >()
  for (const t of topicRes.data ?? []) {
    topicMap.set(t.id, {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      view_count: (t as { view_count?: number }).view_count ?? 0,
    })
  }

  // 5. Assemble response
  const items: NetworkTopicItem[] = []
  for (const ev of page) {
    const actor = actorMap.get(ev.actor_id)
    const topic = topicMap.get(ev.topic_id)
    if (!actor || !topic) continue
    items.push({
      key: ev.key,
      relation: ev.relation,
      vote_side: ev.vote_side,
      acted_at: ev.acted_at,
      actor,
      topic,
    })
  }

  return NextResponse.json({
    items,
    following_count: followingIds.length,
    is_empty: items.length === 0,
  } satisfies NetworkTopicsResponse)
}
