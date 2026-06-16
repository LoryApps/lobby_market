import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FeedEventType = 'vote' | 'argument' | 'post' | 'join'

export interface FeedActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  coalition_role: 'leader' | 'officer' | 'member'
}

export interface FeedEvent {
  id: string
  type: FeedEventType
  timestamp: string
  actor: FeedActor
  // vote
  vote_side?: 'for' | 'against'
  topic_id?: string
  topic_statement?: string
  topic_category?: string | null
  topic_status?: string
  // argument
  argument_body?: string
  argument_side?: 'for' | 'against'
  argument_upvotes?: number
  // post
  post_content?: string
  post_is_pinned?: boolean
  // join — no extra fields needed
}

export interface CoalitionFeedResponse {
  coalition: {
    id: string
    name: string
    member_count: number
    is_public: boolean
  }
  events: FeedEvent[]
  total: number
  isMember: boolean
  cursor: string | null
}

const PAGE_SIZE = 30

// ─── GET /api/coalitions/[id]/feed ────────────────────────────────────────────
// Returns a chronologically-merged stream of coalition member activity:
// votes, arguments, bulletin posts, and member joins.
// Query params: cursor (ISO timestamp for pagination)

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const coalitionId = params.id
  const cursor = req.nextUrl.searchParams.get('cursor') ?? null

  if (!coalitionId) {
    return NextResponse.json({ error: 'Missing coalition id' }, { status: 400 })
  }

  // ── Verify coalition ────────────────────────────────────────────────────────

  const { data: coalition } = await supabase
    .from('coalitions')
    .select('id, name, member_count, is_public')
    .eq('id', coalitionId)
    .maybeSingle()

  if (!coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // ── Current user + membership check ────────────────────────────────────────

  const { data: { user } } = await supabase.auth.getUser()
  let isMember = false

  if (user) {
    const { data: mem } = await supabase
      .from('coalition_members')
      .select('id')
      .eq('coalition_id', coalitionId)
      .eq('user_id', user.id)
      .maybeSingle()
    isMember = !!mem
  }

  // Private coalitions: only members can see the feed
  if (!coalition.is_public && !isMember) {
    return NextResponse.json({ error: 'Private coalition' }, { status: 403 })
  }

  // ── Fetch member ids ────────────────────────────────────────────────────────

  const { data: members } = await supabase
    .from('coalition_members')
    .select('user_id, role, joined_at')
    .eq('coalition_id', coalitionId)
    .order('joined_at', { ascending: false })

  const memberList = members ?? []
  const memberIds = memberList.map((m) => m.user_id)
  const memberRoleMap = new Map(memberList.map((m) => [m.user_id, m.role as 'leader' | 'officer' | 'member']))
  const memberJoinMap = new Map(memberList.map((m) => [m.user_id, m.joined_at as string]))

  if (memberIds.length === 0) {
    return NextResponse.json({
      coalition: { id: coalition.id, name: coalition.name, member_count: coalition.member_count, is_public: coalition.is_public },
      events: [],
      total: 0,
      isMember,
      cursor: null,
    } satisfies CoalitionFeedResponse)
  }

  // ── Fetch profiles ──────────────────────────────────────────────────────────

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', memberIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  function buildActor(userId: string): FeedActor | null {
    const prof = profileMap.get(userId)
    if (!prof) return null
    return {
      id: userId,
      username: prof.username,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      role: prof.role,
      coalition_role: memberRoleMap.get(userId) ?? 'member',
    }
  }

  // ── Time window ─────────────────────────────────────────────────────────────
  // Load events newer than cursor (or the last 90 days if no cursor)

  const before = cursor ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [votesRes, argsRes, postsRes] = await Promise.all([
    // Recent votes by members
    supabase
      .from('votes')
      .select(`
        id, user_id, side, created_at,
        topics ( id, statement, category, status )
      `)
      .in('user_id', memberIds)
      .lt('created_at', cursor ? cursor : new Date().toISOString())
      .gte('created_at', before)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE * 2),

    // Recent arguments by members
    supabase
      .from('topic_arguments')
      .select(`
        id, user_id, side, body, upvotes, created_at,
        topics ( id, statement, category, status )
      `)
      .in('user_id', memberIds)
      .lt('created_at', cursor ? cursor : new Date().toISOString())
      .gte('created_at', before)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),

    // Coalition bulletin posts
    supabase
      .from('coalition_posts')
      .select('id, author_id, content, is_pinned, created_at')
      .eq('coalition_id', coalitionId)
      .lt('created_at', cursor ? cursor : new Date().toISOString())
      .gte('created_at', before)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE),
  ])

  // ── Build events ─────────────────────────────────────────────────────────────

  const events: FeedEvent[] = []

  // Votes
  for (const v of votesRes.data ?? []) {
    const actor = buildActor(v.user_id)
    if (!actor) continue
    const topic = (v as { topics?: { id: string; statement: string; category: string | null; status: string } | null }).topics
    events.push({
      id: `vote-${v.id}`,
      type: 'vote',
      timestamp: v.created_at,
      actor,
      vote_side: v.side as 'for' | 'against',
      topic_id: topic?.id,
      topic_statement: topic?.statement,
      topic_category: topic?.category,
      topic_status: topic?.status,
    })
  }

  // Arguments
  for (const a of argsRes.data ?? []) {
    const actor = buildActor(a.user_id)
    if (!actor) continue
    const topic = (a as { topics?: { id: string; statement: string; category: string | null; status: string } | null }).topics
    events.push({
      id: `arg-${a.id}`,
      type: 'argument',
      timestamp: a.created_at,
      actor,
      argument_body: (a.body as string | null)?.slice(0, 200),
      argument_side: a.side as 'for' | 'against',
      argument_upvotes: (a.upvotes as number | null) ?? 0,
      topic_id: topic?.id,
      topic_statement: topic?.statement,
      topic_category: topic?.category,
      topic_status: topic?.status,
    })
  }

  // Posts
  for (const p of postsRes.data ?? []) {
    const actor = buildActor(p.author_id)
    if (!actor) continue
    events.push({
      id: `post-${p.id}`,
      type: 'post',
      timestamp: p.created_at,
      actor,
      post_content: (p.content as string | null)?.slice(0, 300),
      post_is_pinned: (p.is_pinned as boolean | null) ?? false,
    })
  }

  // Member joins (from the memberList itself, filtered by time window)
  for (const m of memberList) {
    const joinTime = memberJoinMap.get(m.user_id) ?? ''
    if (!joinTime) continue
    if (cursor && joinTime >= cursor) continue
    if (joinTime < before) continue
    const actor = buildActor(m.user_id)
    if (!actor) continue
    events.push({
      id: `join-${m.user_id}`,
      type: 'join',
      timestamp: joinTime,
      actor,
    })
  }

  // ── Sort and paginate ────────────────────────────────────────────────────────

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const page = events.slice(0, PAGE_SIZE)
  const nextCursor = page.length === PAGE_SIZE ? page[PAGE_SIZE - 1].timestamp : null

  return NextResponse.json({
    coalition: {
      id: coalition.id,
      name: coalition.name,
      member_count: coalition.member_count,
      is_public: coalition.is_public,
    },
    events: page,
    total: events.length,
    isMember,
    cursor: nextCursor,
  } satisfies CoalitionFeedResponse)
}
