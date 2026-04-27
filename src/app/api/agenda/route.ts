import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgendaTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
  voting_ends_at: string | null
  created_at: string
}

export interface SubscribedUpdate {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  subscribed_at: string
  updated_at: string | null
}

export interface UpcomingDebate {
  id: string
  title: string
  topic_id: string
  topic_statement: string
  type: string
  scheduled_at: string
  viewer_count: number
  rsvp_count: number
}

export interface CoalitionAction {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  coalition_stance: 'for' | 'against'
  coalition_name: string
  coalition_id: string
}

export interface AgendaResponse {
  unvoted_topics: AgendaTopic[]
  subscribed_updates: SubscribedUpdate[]
  upcoming_debates: UpcomingDebate[]
  coalition_actions: CoalitionAction[]
  preferred_categories: string[]
  is_authenticated: boolean
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated: return a teaser of active topics
  if (!user) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(5)

    return NextResponse.json({
      unvoted_topics: (topics ?? []) as AgendaTopic[],
      subscribed_updates: [],
      upcoming_debates: [],
      coalition_actions: [],
      preferred_categories: [],
      is_authenticated: false,
    } satisfies AgendaResponse)
  }

  // ── Parallel fetches ──────────────────────────────────────────────────────────
  const [profileRes, votedRes, subsRes, debateRsvpRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('category_preferences')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.from('votes').select('topic_id').eq('user_id', user.id),
    supabase
      .from('topic_subscriptions')
      .select('topic_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('debate_rsvps').select('debate_id').eq('user_id', user.id),
  ])

  const preferredCategories: string[] =
    (profileRes.data?.category_preferences as string[] | null) ?? []

  const votedTopicIds = new Set(
    (votedRes.data ?? []).map((v: { topic_id: string }) => v.topic_id),
  )

  // ── Unvoted active/voting topics ─────────────────────────────────────────────
  const { data: rawActive } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(100)

  const sortedUnvoted = ((rawActive ?? []) as AgendaTopic[])
    .filter((t) => !votedTopicIds.has(t.id))
    .sort((a, b) => {
      const ai = preferredCategories.indexOf(a.category ?? '')
      const bi = preferredCategories.indexOf(b.category ?? '')
      const as_ = ai >= 0 ? ai : 999
      const bs_ = bi >= 0 ? bi : 999
      if (as_ !== bs_) return as_ - bs_
      return (b.feed_score ?? 0) - (a.feed_score ?? 0)
    })
    .slice(0, 20)

  // ── Subscribed topic updates ──────────────────────────────────────────────────
  const subscribedTopicIds = (subsRes.data ?? []).map(
    (s: { topic_id: string }) => s.topic_id,
  )

  let subscribedUpdates: SubscribedUpdate[] = []
  if (subscribedTopicIds.length > 0) {
    const { data: subTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('id', subscribedTopicIds)
      .order('updated_at', { ascending: false })

    subscribedUpdates = (subTopics ?? []).map((t) => {
      const sub = (subsRes.data ?? []).find(
        (s: { topic_id: string }) => s.topic_id === t.id,
      )
      return {
        topic_id: t.id as string,
        statement: t.statement as string,
        category: t.category as string | null,
        status: t.status as string,
        blue_pct: t.blue_pct as number,
        total_votes: t.total_votes as number,
        subscribed_at: sub?.created_at ?? '',
        updated_at: (t as { updated_at?: string | null }).updated_at ?? null,
      } satisfies SubscribedUpdate
    })
  }

  // ── Upcoming RSVPd debates ────────────────────────────────────────────────────
  let upcomingDebates: UpcomingDebate[] = []
  const rsvpDebateIds = (debateRsvpRes.data ?? []).map(
    (r: { debate_id: string }) => r.debate_id,
  )

  if (rsvpDebateIds.length > 0) {
    const now = new Date().toISOString()
    const { data: debates } = await supabase
      .from('debates')
      .select('id, title, topic_id, type, scheduled_at, viewer_count, status, topics!inner(statement)')
      .in('id', rsvpDebateIds)
      .gte('scheduled_at', now)
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at', { ascending: true })
      .limit(10)

    const debateIdList = (debates ?? []).map((d) => d.id as string)
    const rsvpCounts: Record<string, number> = {}
    if (debateIdList.length > 0) {
      const { data: counts } = await supabase
        .from('debate_rsvps')
        .select('debate_id')
        .in('debate_id', debateIdList)
      for (const row of counts ?? []) {
        const did = row.debate_id as string
        rsvpCounts[did] = (rsvpCounts[did] ?? 0) + 1
      }
    }

    upcomingDebates = (debates ?? []).map((d) => ({
      id: d.id as string,
      title: d.title as string,
      topic_id: d.topic_id as string,
      topic_statement:
        ((d.topics as unknown as { statement: string }) ?? {}).statement ?? '',
      type: d.type as string,
      scheduled_at: d.scheduled_at as string,
      viewer_count: d.viewer_count as number,
      rsvp_count: rsvpCounts[d.id as string] ?? 0,
    }))
  }

  // ── Coalition stance actions ──────────────────────────────────────────────────
  let coalitionActions: CoalitionAction[] = []

  const { data: memberships } = await supabase
    .from('coalition_members')
    .select('coalition_id')
    .eq('user_id', user.id)

  const coalitionIds = (memberships ?? []).map(
    (m: { coalition_id: string }) => m.coalition_id,
  )

  if (coalitionIds.length > 0) {
    const { data: stances } = await supabase
      .from('coalition_stances')
      .select(
        'stance, coalition_id, coalitions!inner(name), topics!inner(id, statement, category, status, blue_pct, total_votes)',
      )
      .in('coalition_id', coalitionIds)
      .limit(10)

    coalitionActions = (stances ?? [])
      .filter((s) => {
        const t = s.topics as unknown as { id: string; status: string }
        return (
          t?.id &&
          !votedTopicIds.has(t.id) &&
          ['active', 'voting'].includes(t.status ?? '')
        )
      })
      .map((s) => {
        const t = s.topics as unknown as {
          id: string
          statement: string
          category: string | null
          status: string
          blue_pct: number
          total_votes: number
        }
        const c = s.coalitions as unknown as { name: string }
        return {
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          blue_pct: t.blue_pct,
          total_votes: t.total_votes,
          coalition_stance: s.stance as 'for' | 'against',
          coalition_name: c.name,
          coalition_id: s.coalition_id as string,
        } satisfies CoalitionAction
      })
  }

  return NextResponse.json({
    unvoted_topics: sortedUnvoted,
    subscribed_updates: subscribedUpdates,
    upcoming_debates: upcomingDebates,
    coalition_actions: coalitionActions,
    preferred_categories: preferredCategories,
    is_authenticated: true,
  } satisfies AgendaResponse)
}
