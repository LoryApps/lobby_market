import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  vote_delta_24h: number | null
  has_active_debate: boolean
}

export interface DailyDebate {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  scheduled_at: string
  status: string
  title: string | null
  participant_count: number
}

export interface DailyLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
}

export interface DailyEngagement {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  user_side: 'for' | 'against'
  new_arguments: number
}

export interface DailyResponse {
  auth: boolean
  today: string
  // Personal stats (null if not authed)
  personal: {
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    vote_streak: number
    votes_used: number
    daily_limit: number
    reset_at: string | null
    total_votes: number
    rank: number | null
    category_preferences: string[]
  } | null
  // Hot topics right now (most vote activity in last 24h)
  hot_topics: DailyTopic[]
  // Debates starting in the next 24 hours
  upcoming_debates: DailyDebate[]
  // Laws established in the last 7 days
  recent_laws: DailyLaw[]
  // Topics the user voted on with new argument activity (null if not authed)
  your_engagements: DailyEngagement[]
  // Topics matching user's category preferences they haven't voted on yet
  recommended_topics: DailyTopic[]
  // Most controversial topic (highest vote swing in 24h)
  controversy_of_day: DailyTopic | null
  // Platform snapshot
  platform: {
    active_topics: number
    votes_last_24h: number
    laws_this_week: number
    debates_today: number
  }
}

const DAILY_LIMITS: Record<string, number> = {
  person: 10,
  debator: 20,
  troll_catcher: 30,
  elder: 50,
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // ── 1. Personal stats ─────────────────────────────────────────────────────
  let personal: DailyResponse['personal'] = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, clout, vote_streak, daily_votes_used, daily_votes_reset_at, total_votes, role, category_preferences')
      .eq('id', user.id)
      .maybeSingle()

    if (profile) {
      const resetAt = profile.daily_votes_reset_at ? new Date(profile.daily_votes_reset_at) : null
      const votesUsed = resetAt && now < resetAt ? (profile.daily_votes_used ?? 0) : 0
      const limit = DAILY_LIMITS[profile.role ?? 'person'] ?? 10

      // Rough rank: count profiles with higher clout
      const { count: higherCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('clout', profile.clout ?? 0)

      personal = {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        clout: profile.clout ?? 0,
        vote_streak: profile.vote_streak ?? 0,
        votes_used: votesUsed,
        daily_limit: limit,
        reset_at: profile.daily_votes_reset_at ?? null,
        total_votes: profile.total_votes ?? 0,
        rank: higherCount != null ? higherCount + 1 : null,
        category_preferences: profile.category_preferences ?? [],
      }
    }
  }

  // ── 2. Hot topics (most recent vote activity in last 24h) ─────────────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', yesterday.toISOString())

  // Count votes per topic in last 24h
  const topicVoteMap = new Map<string, number>()
  for (const v of recentVotes ?? []) {
    topicVoteMap.set(v.topic_id, (topicVoteMap.get(v.topic_id) ?? 0) + 1)
  }

  const hotTopicIds = [...topicVoteMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id]) => id)

  let hotTopics: DailyTopic[] = []
  if (hotTopicIds.length > 0) {
    const { data: ht } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', hotTopicIds)
      .in('status', ['active', 'voting'])

    // Check which have active debates
    const { data: activeDebates } = await supabase
      .from('debates')
      .select('topic_id')
      .in('topic_id', hotTopicIds)
      .eq('status', 'live')

    const debateSet = new Set((activeDebates ?? []).map(d => d.topic_id))

    hotTopics = (ht ?? [])
      .map(t => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        vote_delta_24h: topicVoteMap.get(t.id) ?? 0,
        has_active_debate: debateSet.has(t.id),
      }))
      .sort((a, b) => (b.vote_delta_24h ?? 0) - (a.vote_delta_24h ?? 0))
      .slice(0, 6)
  }

  // ── 3. Upcoming debates in next 24h ───────────────────────────────────────
  const { data: upcomingRaw } = await supabase
    .from('debates')
    .select('id, topic_id, scheduled_at, status, title')
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', next24h.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(6)

  const upcomingDebateTopicIds = (upcomingRaw ?? []).map(d => d.topic_id).filter(Boolean)
  const debateTopics: Record<string, { statement: string; category: string | null }> = {}

  if (upcomingDebateTopicIds.length > 0) {
    const { data: dt } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', upcomingDebateTopicIds)
    for (const t of dt ?? []) {
      debateTopics[t.id] = { statement: t.statement, category: t.category }
    }
  }

  // Participant counts
  const upcomingDebateIds = (upcomingRaw ?? []).map(d => d.id)
  const rsvpCounts: Record<string, number> = {}
  if (upcomingDebateIds.length > 0) {
    const { data: rsvps } = await supabase
      .from('debate_rsvps')
      .select('debate_id')
      .in('debate_id', upcomingDebateIds)
    for (const r of rsvps ?? []) {
      rsvpCounts[r.debate_id] = (rsvpCounts[r.debate_id] ?? 0) + 1
    }
  }

  const upcomingDebates: DailyDebate[] = (upcomingRaw ?? []).map(d => ({
    id: d.id,
    topic_id: d.topic_id,
    topic_statement: debateTopics[d.topic_id]?.statement ?? 'Unknown topic',
    topic_category: debateTopics[d.topic_id]?.category ?? null,
    scheduled_at: d.scheduled_at,
    status: d.status,
    title: d.title ?? null,
    participant_count: rsvpCounts[d.id] ?? 0,
  }))

  // ── 4. Recent laws (last 7 days) ──────────────────────────────────────────
  const { data: recentLawRows } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, established_at')
    .gte('established_at', lastWeek.toISOString())
    .order('established_at', { ascending: false })
    .limit(5)

  const recentLaws: DailyLaw[] = (recentLawRows ?? []).map(l => ({
    id: l.id,
    topic_id: l.topic_id,
    statement: l.statement,
    category: l.category,
    established_at: l.established_at,
  }))

  // ── 5. Your engagements (topics you voted on with new 24h argument activity) ─
  let yourEngagements: DailyEngagement[] = []
  if (user) {
    const { data: userVotes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const votedTopicIds = (userVotes ?? []).map(v => v.topic_id)
    const userVoteSides = new Map<string, string>()
    for (const v of userVotes ?? []) {
      if (!userVoteSides.has(v.topic_id)) userVoteSides.set(v.topic_id, v.side)
    }

    if (votedTopicIds.length > 0) {
      // Find topics with recent argument activity
      const { data: recentArgs } = await supabase
        .from('topic_arguments')
        .select('topic_id')
        .in('topic_id', votedTopicIds)
        .gte('created_at', yesterday.toISOString())

      const argActivityMap = new Map<string, number>()
      for (const a of recentArgs ?? []) {
        argActivityMap.set(a.topic_id, (argActivityMap.get(a.topic_id) ?? 0) + 1)
      }

      const activeVotedIds = [...argActivityMap.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id)

      if (activeVotedIds.length > 0) {
        const { data: engagementTopics } = await supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct')
          .in('id', activeVotedIds)

        yourEngagements = (engagementTopics ?? []).map(t => ({
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          blue_pct: t.blue_pct ?? 50,
          user_side: (userVoteSides.get(t.id) === 'blue' ? 'for' : 'against') as 'for' | 'against',
          new_arguments: argActivityMap.get(t.id) ?? 0,
        }))
      }
    }
  }

  // ── 6. Recommended topics (match user prefs, not yet voted) ───────────────
  let recommendedTopics: DailyTopic[] = []
  if (personal && personal.category_preferences.length > 0) {
    const { data: userVotedIds } = user ? await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id) : { data: [] }

    const votedSet = new Set((userVotedIds ?? []).map(v => v.topic_id))

    const { data: recRaw } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('category', personal.category_preferences)
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(20)

    recommendedTopics = (recRaw ?? [])
      .filter(t => !votedSet.has(t.id))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        vote_delta_24h: topicVoteMap.get(t.id) ?? 0,
        has_active_debate: false,
      }))
  }

  // If no prefs or not enough, fill with popular unvoted topics
  if (recommendedTopics.length < 3) {
    const { data: userVotedIds } = user ? await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id) : { data: [] }

    const votedSet = new Set((userVotedIds ?? []).map(v => v.topic_id))

    const { data: popularRaw } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(20)

    const extras = (popularRaw ?? [])
      .filter(t => !votedSet.has(t.id) && !recommendedTopics.some(r => r.id === t.id))
      .slice(0, 5 - recommendedTopics.length)
      .map(t => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        vote_delta_24h: topicVoteMap.get(t.id) ?? 0,
        has_active_debate: false,
      }))

    recommendedTopics = [...recommendedTopics, ...extras]
  }

  // ── 7. Controversy of the day (most volatile: closest to 50/50) ───────────
  let controversyOfDay: DailyTopic | null = null
  if (hotTopics.length > 0) {
    controversyOfDay = hotTopics.reduce((best, t) => {
      const dist = Math.abs(t.blue_pct - 50)
      const bestDist = Math.abs(best.blue_pct - 50)
      return dist < bestDist ? t : best
    }, hotTopics[0])
  } else {
    const { data: ctRaw } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .gte('blue_pct', 40)
      .lte('blue_pct', 60)
      .order('total_votes', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ctRaw) {
      controversyOfDay = {
        id: ctRaw.id,
        statement: ctRaw.statement,
        category: ctRaw.category,
        status: ctRaw.status,
        blue_pct: ctRaw.blue_pct ?? 50,
        total_votes: ctRaw.total_votes ?? 0,
        vote_delta_24h: topicVoteMap.get(ctRaw.id) ?? 0,
        has_active_debate: false,
      }
    }
  }

  // ── 8. Platform snapshot ──────────────────────────────────────────────────
  const { count: activeTopicCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'voting'])

  const votes24hCount = recentVotes?.length ?? 0

  const { count: lawsThisWeek } = await supabase
    .from('laws')
    .select('id', { count: 'exact', head: true })
    .gte('established_at', lastWeek.toISOString())

  const { count: debatesToday } = await supabase
    .from('debates')
    .select('id', { count: 'exact', head: true })
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', next24h.toISOString())

  const response: DailyResponse = {
    auth: !!user,
    today: now.toISOString(),
    personal,
    hot_topics: hotTopics,
    upcoming_debates: upcomingDebates,
    recent_laws: recentLaws,
    your_engagements: yourEngagements,
    recommended_topics: recommendedTopics,
    controversy_of_day: controversyOfDay,
    platform: {
      active_topics: activeTopicCount ?? 0,
      votes_last_24h: votes24hCount,
      laws_this_week: lawsThisWeek ?? 0,
      debates_today: debatesToday ?? 0,
    },
  }

  return NextResponse.json(response)
}
