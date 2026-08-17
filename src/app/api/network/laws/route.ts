import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type NetworkLawRelation = 'proposed' | 'voted' | 'argued'

export interface NetworkLawActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkLawItem {
  key: string
  relation: NetworkLawRelation
  vote_side?: 'blue' | 'red'
  acted_at: string
  actor: NetworkLawActor
  law: {
    id: string
    topic_id: string
    statement: string
    category: string | null
    blue_pct: number | null
    total_votes: number | null
    established_at: string
  }
}

export interface NetworkLawsResponse {
  items: NetworkLawItem[]
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
    } satisfies NetworkLawsResponse)
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // 2. Parallel fetch: proposed topics that became laws, votes on law-topics, arguments on law-topics
  const [proposedRes, votesRes, argumentsRes] = await Promise.all([
    // Topics authored by followed users that are now laws
    supabase
      .from('topics')
      .select('id, author_id, created_at')
      .in('author_id', followingIds)
      .eq('status', 'law')
      .order('created_at', { ascending: false })
      .limit(limit * 2),

    // Votes cast by followed users on topics that are now laws
    supabase
      .from('votes')
      .select('id, user_id, topic_id, side, created_at')
      .in('user_id', followingIds)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(limit * 4),

    // Arguments by followed users on topics that are now laws
    supabase
      .from('arguments')
      .select('id, user_id, topic_id, side, created_at')
      .in('user_id', followingIds)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(limit * 4),
  ])

  // 3. Collect all unique topic IDs to filter by law status
  const allTopicIds = new Set<string>()

  // Proposed topics are already filtered to status=law
  const proposedTopicIds = new Set<string>(
    (proposedRes.data ?? []).map((r) => r.id as string)
  )
  for (const id of proposedTopicIds) allTopicIds.add(id)

  // Voted and argued topics need to be cross-checked against laws table
  for (const v of votesRes.data ?? []) allTopicIds.add(v.topic_id as string)
  for (const a of argumentsRes.data ?? []) allTopicIds.add(a.topic_id as string)

  if (allTopicIds.size === 0) {
    return NextResponse.json({
      items: [],
      following_count: followingIds.length,
      is_empty: true,
    } satisfies NetworkLawsResponse)
  }

  // 4. Fetch laws for all candidate topic IDs
  const { data: lawRows, error: lawErr } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
    .in('topic_id', Array.from(allTopicIds))
    .gte('established_at', ninetyDaysAgo)
    .order('established_at', { ascending: false })

  if (lawErr) {
    return NextResponse.json({ error: 'Failed to fetch laws' }, { status: 500 })
  }

  const lawMap = new Map<
    string,
    {
      id: string
      topic_id: string
      statement: string
      category: string | null
      blue_pct: number | null
      total_votes: number | null
      established_at: string
    }
  >()
  for (const l of lawRows ?? []) {
    lawMap.set(l.topic_id as string, {
      id: l.id,
      topic_id: l.topic_id,
      statement: l.statement,
      category: l.category as string | null,
      blue_pct: l.blue_pct as number | null,
      total_votes: l.total_votes as number | null,
      established_at: l.established_at,
    })
  }

  if (lawMap.size === 0) {
    return NextResponse.json({
      items: [],
      following_count: followingIds.length,
      is_empty: true,
    } satisfies NetworkLawsResponse)
  }

  // 5. Build raw events — one per (actor, topic_id) with dedup key
  const rawEvents: {
    key: string
    actor_id: string
    topic_id: string
    relation: NetworkLawRelation
    vote_side?: 'blue' | 'red'
    acted_at: string
  }[] = []

  const seen = new Set<string>()

  function add(
    relation: NetworkLawRelation,
    actorId: string,
    topicId: string,
    actedAt: string,
    voteSide?: 'blue' | 'red',
  ) {
    if (!lawMap.has(topicId)) return
    const key = `${relation}:${actorId}:${topicId}`
    if (seen.has(key)) return
    seen.add(key)
    rawEvents.push({ key, actor_id: actorId, topic_id: topicId, relation, vote_side: voteSide, acted_at: actedAt })
  }

  // Proposed (highest priority)
  for (const r of proposedRes.data ?? []) {
    add('proposed', r.author_id as string, r.id as string, r.created_at as string)
  }

  // Argued
  for (const r of argumentsRes.data ?? []) {
    const side = r.side === 'blue' ? 'blue' : 'red'
    add('argued', r.user_id as string, r.topic_id as string, r.created_at as string, side)
  }

  // Voted
  for (const r of votesRes.data ?? []) {
    const side = r.side === 'blue' ? 'blue' : 'red'
    add('voted', r.user_id as string, r.topic_id as string, r.created_at as string, side)
  }

  // Sort by established_at of the law (most recently established first)
  rawEvents.sort((a, b) => {
    const lawA = lawMap.get(a.topic_id)
    const lawB = lawMap.get(b.topic_id)
    return (lawB?.established_at ?? '').localeCompare(lawA?.established_at ?? '')
  })

  const page = rawEvents.slice(0, limit)

  if (page.length === 0) {
    return NextResponse.json({
      items: [],
      following_count: followingIds.length,
      is_empty: true,
    } satisfies NetworkLawsResponse)
  }

  // 6. Batch-fetch profiles
  const actorIds = Array.from(new Set(page.map((e) => e.actor_id)))

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', actorIds)

  const actorMap = new Map<string, NetworkLawActor>()
  for (const p of profileRows ?? []) {
    actorMap.set(p.id, {
      id: p.id,
      username: p.username,
      display_name: p.display_name as string | null,
      avatar_url: p.avatar_url as string | null,
      role: p.role ?? 'citizen',
    })
  }

  // 7. Assemble response
  const items: NetworkLawItem[] = []
  for (const ev of page) {
    const actor = actorMap.get(ev.actor_id)
    const law = lawMap.get(ev.topic_id)
    if (!actor || !law) continue
    items.push({
      key: ev.key,
      relation: ev.relation,
      vote_side: ev.vote_side,
      acted_at: ev.acted_at,
      actor,
      law,
    })
  }

  return NextResponse.json({
    items,
    following_count: followingIds.length,
    is_empty: items.length === 0,
  } satisfies NetworkLawsResponse)
}
