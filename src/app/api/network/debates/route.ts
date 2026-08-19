import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type NetworkDebateRelation = 'creator' | 'speaker' | 'rsvp'

export interface NetworkDebateActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkDebateTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface NetworkDebateItem {
  id: string
  debate_id: string
  debate_title: string
  debate_type: string
  debate_status: string
  scheduled_at: string
  blue_sway: number
  red_sway: number
  relation: NetworkDebateRelation
  actor: NetworkDebateActor
  topic: NetworkDebateTopic
}

export interface NetworkDebatesResponse {
  debates: NetworkDebateItem[]
  following_count: number
  is_empty: boolean
  cursor: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 60)

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
      debates: [],
      following_count: 0,
      is_empty: true,
      cursor: null,
    } satisfies NetworkDebatesResponse)
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 2. Parallel fetch: creators, speakers, rsvps
  const [creatorRes, participantRes, rsvpRes] = await Promise.all([
    supabase
      .from('debates')
      .select('id, title, type, status, scheduled_at, blue_sway, red_sway, topic_id, creator_id')
      .in('creator_id', followingIds)
      .gte('scheduled_at', thirtyDaysAgo)
      .order('scheduled_at', { ascending: false })
      .limit(limit),

    supabase
      .from('debate_participants')
      .select('debate_id, user_id, is_speaker')
      .in('user_id', followingIds)
      .limit(limit * 2),

    supabase
      .from('debate_rsvps')
      .select('debate_id, user_id, created_at')
      .in('user_id', followingIds)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(limit * 2),
  ])

  // 3. Collect all unique debate IDs
  const debateIdToRelation = new Map<string, { userId: string; relation: NetworkDebateRelation }>()

  // Speakers first (highest priority)
  for (const row of (participantRes.data ?? []) as { debate_id: string; user_id: string; is_speaker: boolean }[]) {
    if (row.is_speaker && !debateIdToRelation.has(row.debate_id)) {
      debateIdToRelation.set(row.debate_id, { userId: row.user_id, relation: 'speaker' })
    }
  }

  // Creators
  for (const row of (creatorRes.data ?? []) as { id: string; creator_id: string }[]) {
    if (!debateIdToRelation.has(row.id)) {
      debateIdToRelation.set(row.id, { userId: row.creator_id, relation: 'creator' })
    }
  }

  // Non-speaker participants
  for (const row of (participantRes.data ?? []) as { debate_id: string; user_id: string; is_speaker: boolean }[]) {
    if (!row.is_speaker && !debateIdToRelation.has(row.debate_id)) {
      debateIdToRelation.set(row.debate_id, { userId: row.user_id, relation: 'rsvp' })
    }
  }

  // RSVPs
  for (const row of (rsvpRes.data ?? []) as { debate_id: string; user_id: string }[]) {
    if (!debateIdToRelation.has(row.debate_id)) {
      debateIdToRelation.set(row.debate_id, { userId: row.user_id, relation: 'rsvp' })
    }
  }

  if (debateIdToRelation.size === 0) {
    return NextResponse.json({
      debates: [],
      following_count: followingIds.length,
      is_empty: true,
      cursor: null,
    } satisfies NetworkDebatesResponse)
  }

  const debateIds = Array.from(debateIdToRelation.keys())

  // 4. Fetch full debate rows + topics
  const { data: debateRows, error: debateErr } = await supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, blue_sway, red_sway, topic_id')
    .in('id', debateIds)
    .order('scheduled_at', { ascending: false })
    .limit(limit + 1)

  if (debateErr) {
    return NextResponse.json({ error: 'Failed to fetch debates' }, { status: 500 })
  }

  const rows = debateRows ?? []
  const topicIds = [...new Set(rows.map((d) => (d as { topic_id: string }).topic_id).filter(Boolean))]

  // 5. Fetch topics
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  const topicMap = new Map<string, NetworkDebateTopic>()
  for (const t of topicRows ?? []) {
    topicMap.set(t.id, {
      id: t.id,
      statement: t.statement,
      category: t.category as string | null,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
    })
  }

  // 6. Fetch profiles for involved actors
  const actorIds = [...new Set(Array.from(debateIdToRelation.values()).map((v) => v.userId))]
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', actorIds)

  const profileMap = new Map<string, NetworkDebateActor>()
  for (const p of profileRows ?? []) {
    profileMap.set(p.id, {
      id: p.id,
      username: p.username,
      display_name: p.display_name as string | null,
      avatar_url: p.avatar_url as string | null,
      role: p.role,
    })
  }

  // 7. Build result items
  const items: NetworkDebateItem[] = []
  const pageRows = rows.slice(0, limit)

  for (const debate of pageRows) {
    const d = debate as {
      id: string
      title: string
      type: string
      status: string
      scheduled_at: string
      blue_sway: number
      red_sway: number
      topic_id: string
    }

    const rel = debateIdToRelation.get(d.id)
    if (!rel) continue

    const actor = profileMap.get(rel.userId)
    const topic = topicMap.get(d.topic_id)
    if (!actor || !topic) continue

    items.push({
      id: `${d.id}-${rel.userId}`,
      debate_id: d.id,
      debate_title: d.title,
      debate_type: d.type,
      debate_status: d.status,
      scheduled_at: d.scheduled_at,
      blue_sway: d.blue_sway ?? 0,
      red_sway: d.red_sway ?? 0,
      relation: rel.relation,
      actor,
      topic,
    })
  }

  const nextCursor =
    rows.length > limit ? pageRows[pageRows.length - 1]?.scheduled_at ?? null : null

  return NextResponse.json({
    debates: items,
    following_count: followingIds.length,
    is_empty: items.length === 0,
    cursor: nextCursor,
  } satisfies NetworkDebatesResponse)
}
