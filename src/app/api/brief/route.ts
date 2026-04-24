import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  feed_score: number
  voting_ends_at: string | null
}

export interface BriefLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface BriefDebate {
  id: string
  title: string
  status: string
  type: string
  scheduled_at: string
  viewer_count: number
  topic_statement: string | null
  topic_category: string | null
}

export interface BriefProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  vote_streak: number
  total_votes: number
  clout: number
  reputation_score: number
  daily_votes_used: number
  category_preferences: string[]
}

export interface BriefData {
  date: string
  profile: BriefProfile | null
  hotTopics: BriefTopic[]
  nearLawTopics: BriefTopic[]
  recentLaws: BriefLaw[]
  todayDebates: BriefDebate[]
  unreadNotifications: number
  platformPulse: {
    activeTopics: number
    votingTopics: number
    liveDebates: number
    lawsThisWeek: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date(now)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
  tomorrowEnd.setHours(23, 59, 59, 999)
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Profile fetch (optional — personalises hot topics by category pref)
  let profile: BriefProfile | null = null
  let categoryPrefs: string[] = []
  let unreadCount = 0

  if (user) {
    const [profileRes, notifRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'username, display_name, avatar_url, vote_streak, total_votes, ' +
            'clout, reputation_score, daily_votes_used, category_preferences'
        )
        .eq('id', user.id)
        .single(),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false),
    ])

    if (profileRes.data) {
      profile = profileRes.data as unknown as BriefProfile
      categoryPrefs = profile.category_preferences ?? []
    }
    unreadCount = notifRes.count ?? 0
  }

  // Build hot-topics query — prefer user's categories when available
  let hotTopicsQuery = supabase
    .from('topics')
    .select(
      'id, statement, category, status, total_votes, blue_pct, feed_score, voting_ends_at'
    )
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })

  if (categoryPrefs.length > 0) {
    hotTopicsQuery = hotTopicsQuery.in('category', categoryPrefs)
  }

  hotTopicsQuery = hotTopicsQuery.limit(6)

  // Near-law: proposed/active topics with ≥62% FOR and ≥50 votes
  const nearLawQuery = supabase
    .from('topics')
    .select(
      'id, statement, category, status, total_votes, blue_pct, feed_score, voting_ends_at'
    )
    .in('status', ['active', 'voting'])
    .gte('blue_pct', 62)
    .gte('total_votes', 50)
    .order('blue_pct', { ascending: false })
    .limit(4)

  // Laws from the last 24 hours
  const recentLawsQuery = supabase
    .from('laws')
    .select('id, statement, category, total_votes, blue_pct, established_at')
    .gte('established_at', dayAgo.toISOString())
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(5)

  // Debates scheduled today + tomorrow (or live now)
  const debatesQuery = supabase
    .from('debates')
    .select('id, title, status, type, scheduled_at, viewer_count, topic_id')
    .or(`status.eq.live,and(status.eq.scheduled,scheduled_at.gte.${todayStart.toISOString()},scheduled_at.lte.${tomorrowEnd.toISOString()})`)
    .order('status', { ascending: true })
    .order('scheduled_at', { ascending: true })
    .limit(5)

  // Platform pulse
  const [
    hotRes,
    nearLawRes,
    lawsRes,
    debatesRes,
    activeCountRes,
    votingCountRes,
    liveDebatesRes,
    weekLawsRes,
  ] = await Promise.all([
    hotTopicsQuery,
    nearLawQuery,
    recentLawsQuery,
    debatesQuery,
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'voting'),
    supabase
      .from('debates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'live'),
    supabase
      .from('laws')
      .select('id', { count: 'exact', head: true })
      .gte('established_at', weekAgo.toISOString())
      .eq('is_active', true),
  ])

  // If user has category prefs but got no results, fall back to global hot topics
  let hotTopics = (hotRes.data ?? []) as BriefTopic[]
  if (hotTopics.length === 0 && categoryPrefs.length > 0) {
    const fallback = await supabase
      .from('topics')
      .select(
        'id, statement, category, status, total_votes, blue_pct, feed_score, voting_ends_at'
      )
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(6)
    hotTopics = (fallback.data ?? []) as BriefTopic[]
  }

  // Enrich debates with topic statements
  const rawDebates = debatesRes.data ?? []
  const debateTopicIds = Array.from(
    new Set(rawDebates.map((d) => d.topic_id as string).filter(Boolean))
  )
  const topicStatements: Map<string, { statement: string; category: string | null }> = new Map()

  if (debateTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', debateTopicIds)
    for (const t of topicRows ?? []) {
      topicStatements.set(t.id as string, {
        statement: t.statement as string,
        category: t.category as string | null,
      })
    }
  }

  const debates: BriefDebate[] = rawDebates.map((d) => {
    const topic = topicStatements.get(d.topic_id as string)
    return {
      id: d.id as string,
      title: d.title as string,
      status: d.status as string,
      type: d.type as string,
      scheduled_at: d.scheduled_at as string,
      viewer_count: (d.viewer_count as number) ?? 0,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
    }
  })

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const data: BriefData = {
    date: dateLabel,
    profile,
    hotTopics,
    nearLawTopics: (nearLawRes.data ?? []) as BriefTopic[],
    recentLaws: (lawsRes.data ?? []) as BriefLaw[],
    todayDebates: debates,
    unreadNotifications: unreadCount,
    platformPulse: {
      activeTopics: activeCountRes.count ?? 0,
      votingTopics: votingCountRes.count ?? 0,
      liveDebates: liveDebatesRes.count ?? 0,
      lawsThisWeek: weekLawsRes.count ?? 0,
    },
  }

  return NextResponse.json(data)
}
