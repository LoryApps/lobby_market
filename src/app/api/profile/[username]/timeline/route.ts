import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'vote'
  | 'argument'
  | 'debate_join'
  | 'achievement'
  | 'coalition_join'
  | 'topic_created'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  occurred_at: string
  // vote
  vote_side?: 'blue' | 'red'
  vote_topic_id?: string
  vote_topic_statement?: string
  vote_topic_category?: string | null
  vote_topic_status?: string
  // argument
  arg_id?: string
  arg_content?: string
  arg_side?: 'blue' | 'red'
  arg_upvotes?: number
  arg_ai_grade?: string | null
  arg_topic_id?: string
  arg_topic_statement?: string
  arg_topic_category?: string | null
  // debate
  debate_id?: string
  debate_topic_id?: string
  debate_topic_statement?: string
  debate_side?: string
  debate_is_speaker?: boolean
  // achievement
  achievement_name?: string
  achievement_tier?: string
  achievement_description?: string
  achievement_icon?: string | null
  // coalition
  coalition_id?: string
  coalition_name?: string
  coalition_role?: string
  // topic
  topic_id?: string
  topic_statement?: string
  topic_category?: string | null
  topic_status?: string
}

export interface ProfileTimelineResponse {
  events: TimelineEvent[]
  next_cursor: string | null
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    total_votes: number
    total_arguments: number
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor') ?? undefined
  const filter = searchParams.get('filter') ?? 'all'

  const supabase = await createClient()

  // ── Profile lookup ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, total_votes, total_arguments')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const userId = profile.id
  const before = cursor ?? new Date(Date.now() + 1000).toISOString()

  // ── Parallel data fetches ───────────────────────────────────────────────────
  const wantVotes      = filter === 'all' || filter === 'votes'
  const wantArgs       = filter === 'all' || filter === 'arguments'
  const wantDebates    = filter === 'all' || filter === 'debates'
  const wantAchieves   = filter === 'all' || filter === 'achievements'
  const wantCoalitions = filter === 'all' || filter === 'coalitions'
  const wantTopics     = filter === 'all' || filter === 'topics'

  const [votesRes, argsRes, debatesRes, achievesRes, coalitionsRes, topicsRes] =
    await Promise.all([
      wantVotes
        ? supabase
            .from('votes')
            .select('id, topic_id, side, created_at')
            .eq('user_id', userId)
            .lt('created_at', before)
            .order('created_at', { ascending: false })
            .limit(150)
        : Promise.resolve({ data: null }),

      wantArgs
        ? supabase
            .from('topic_arguments')
            .select('id, topic_id, side, content, upvotes, ai_grade, created_at')
            .eq('user_id', userId)
            .lt('created_at', before)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null }),

      wantDebates
        ? supabase
            .from('debate_participants')
            .select('id, debate_id, side, is_speaker, joined_at')
            .eq('user_id', userId)
            .lt('joined_at', before)
            .order('joined_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null }),

      wantAchieves
        ? supabase
            .from('user_achievements')
            .select('id, achievement_id, earned_at')
            .eq('user_id', userId)
            .lt('earned_at', before)
            .order('earned_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null }),

      wantCoalitions
        ? supabase
            .from('coalition_members')
            .select('id, coalition_id, role, joined_at')
            .eq('user_id', userId)
            .lt('joined_at', before)
            .order('joined_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null }),

      wantTopics
        ? supabase
            .from('topics')
            .select('id, statement, category, status, created_at')
            .eq('author_id', userId)
            .lt('created_at', before)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: null }),
    ])

  const votes      = votesRes.data ?? []
  const args       = argsRes.data ?? []
  const debateParts = debatesRes.data ?? []
  const achieves   = achievesRes.data ?? []
  const coalMems   = coalitionsRes.data ?? []
  const topics     = topicsRes.data ?? []

  // ── Enrich: topics for votes ───────────────────────────────────────────────
  const voteTopicIds = Array.from(new Set(votes.map((v) => v.topic_id)))
  const { data: voteTopics } = voteTopicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category, status')
        .in('id', voteTopicIds)
    : { data: [] }
  const voteTopicMap = new Map((voteTopics ?? []).map((t) => [t.id, t]))

  // ── Enrich: topics for arguments ──────────────────────────────────────────
  const argTopicIds = Array.from(new Set(args.map((a) => a.topic_id)))
  const { data: argTopics } = argTopicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category')
        .in('id', argTopicIds)
    : { data: [] }
  const argTopicMap = new Map((argTopics ?? []).map((t) => [t.id, t]))

  // ── Enrich: debates with topic info ───────────────────────────────────────
  const debateIds = Array.from(new Set(debateParts.map((d) => d.debate_id)))
  const { data: debateRows } = debateIds.length
    ? await supabase
        .from('debates')
        .select('id, topic_id')
        .in('id', debateIds)
    : { data: [] }
  const debateMap = new Map((debateRows ?? []).map((d) => [d.id, d]))

  const debateTopicIds = Array.from(
    new Set((debateRows ?? []).map((d) => d.topic_id).filter(Boolean))
  )
  const { data: debateTopicRows } = debateTopicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category')
        .in('id', debateTopicIds)
    : { data: [] }
  const debateTopicMap = new Map((debateTopicRows ?? []).map((t) => [t.id, t]))

  // ── Enrich: achievements ──────────────────────────────────────────────────
  const achieveIds = Array.from(new Set(achieves.map((a) => a.achievement_id)))
  const { data: achieveRows } = achieveIds.length
    ? await supabase
        .from('achievements')
        .select('id, name, tier, description, icon')
        .in('id', achieveIds)
    : { data: [] }
  const achieveMap = new Map((achieveRows ?? []).map((a) => [a.id, a]))

  // ── Enrich: coalitions ────────────────────────────────────────────────────
  const coalitionIds = Array.from(new Set(coalMems.map((c) => c.coalition_id)))
  const { data: coalitionRows } = coalitionIds.length
    ? await supabase
        .from('coalitions')
        .select('id, name')
        .in('id', coalitionIds)
    : { data: [] }
  const coalitionMap = new Map((coalitionRows ?? []).map((c) => [c.id, c]))

  // ── Build unified event list ───────────────────────────────────────────────
  const events: TimelineEvent[] = []

  for (const v of votes) {
    const t = voteTopicMap.get(v.topic_id)
    events.push({
      id: `vote-${v.id}`,
      type: 'vote',
      occurred_at: v.created_at,
      vote_side: v.side as 'blue' | 'red',
      vote_topic_id: v.topic_id,
      vote_topic_statement: t?.statement,
      vote_topic_category: t?.category ?? null,
      vote_topic_status: t?.status,
    })
  }

  for (const a of args) {
    const t = argTopicMap.get(a.topic_id)
    events.push({
      id: `arg-${a.id}`,
      type: 'argument',
      occurred_at: a.created_at,
      arg_id: a.id,
      arg_content: a.content.slice(0, 200),
      arg_side: a.side as 'blue' | 'red',
      arg_upvotes: a.upvotes,
      arg_ai_grade: a.ai_grade,
      arg_topic_id: a.topic_id,
      arg_topic_statement: t?.statement,
      arg_topic_category: t?.category ?? null,
    })
  }

  for (const dp of debateParts) {
    const debate = debateMap.get(dp.debate_id)
    const topic = debate?.topic_id ? debateTopicMap.get(debate.topic_id) : null
    events.push({
      id: `debate-${dp.id}`,
      type: 'debate_join',
      occurred_at: dp.joined_at,
      debate_id: dp.debate_id,
      debate_topic_id: debate?.topic_id,
      debate_topic_statement: topic?.statement,
      debate_side: dp.side,
      debate_is_speaker: dp.is_speaker,
    })
  }

  for (const ua of achieves) {
    const ach = achieveMap.get(ua.achievement_id)
    events.push({
      id: `ach-${ua.id}`,
      type: 'achievement',
      occurred_at: ua.earned_at,
      achievement_name: ach?.name,
      achievement_tier: ach?.tier,
      achievement_description: ach?.description,
      achievement_icon: ach?.icon ?? null,
    })
  }

  for (const cm of coalMems) {
    const coalition = coalitionMap.get(cm.coalition_id)
    events.push({
      id: `coal-${cm.id}`,
      type: 'coalition_join',
      occurred_at: cm.joined_at,
      coalition_id: cm.coalition_id,
      coalition_name: coalition?.name,
      coalition_role: cm.role,
    })
  }

  for (const t of topics) {
    events.push({
      id: `topic-${t.id}`,
      type: 'topic_created',
      occurred_at: t.created_at,
      topic_id: t.id,
      topic_statement: t.statement,
      topic_category: t.category ?? null,
      topic_status: t.status,
    })
  }

  // ── Sort and paginate ──────────────────────────────────────────────────────
  events.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

  const page = events.slice(0, PAGE_SIZE)
  const next_cursor =
    events.length > PAGE_SIZE ? events[PAGE_SIZE].occurred_at : null

  return NextResponse.json({
    events: page,
    next_cursor,
    profile,
  } satisfies ProfileTimelineResponse)
}
