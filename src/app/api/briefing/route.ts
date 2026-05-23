import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefingProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  vote_streak: number
  clout: number
  daily_votes_used: number
  daily_limit: number
}

export interface BriefingSubscribedUpdate {
  topic_id: string
  statement: string
  category: string | null
  old_status: string | null
  new_status: string
  blue_pct: number
  total_votes: number
  updated_at: string
}

export interface BriefingDebate {
  id: string
  title: string
  topic_id: string | null
  topic_statement: string | null
  scheduled_at: string
  debate_type: string
  status: string
  participant_count: number
}

export interface BriefingFeaturedArgument {
  id: string
  topic_id: string
  topic_statement: string
  category: string | null
  side: 'blue' | 'red'
  content: string
  upvotes: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface BriefingHighlight {
  type: 'trending_topic' | 'new_law' | 'heated_debate'
  topic_id?: string
  debate_id?: string
  statement: string
  category: string | null
  blue_pct?: number
  total_votes?: number
}

export interface BriefingData {
  profile: BriefingProfile
  subscribed_updates: BriefingSubscribedUpdate[]
  upcoming_debates: BriefingDebate[]
  featured_argument: BriefingFeaturedArgument | null
  highlights: BriefingHighlight[]
  unread_notification_count: number
  top_category: string | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()

  const [
    profileRes,
    subscriptionsRes,
    debatesRes,
    notificationsRes,
    topCategoryRes,
  ] = await Promise.all([
    // Profile
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role, vote_streak, clout, daily_votes_used, daily_votes_reset_at')
      .eq('id', user.id)
      .maybeSingle(),

    // User's subscribed topics
    supabase
      .from('topic_subscriptions')
      .select('topic_id')
      .eq('user_id', user.id)
      .limit(50),

    // Upcoming debates in next 48h
    supabase
      .from('debates')
      .select('id, title, topic_id, scheduled_at, debate_type, status')
      .in('status', ['scheduled', 'live'])
      .lte('scheduled_at', twoDaysFromNow)
      .gte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(5),

    // Unread notification count
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false),

    // Top voted category for featured argument selection
    supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  if (!profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const profile = profileRes.data
  const dailyLimit =
    profile.role === 'elder' ? 20
    : profile.role === 'troll_catcher' ? 15
    : profile.role === 'debator' ? 12
    : 10

  // ── Subscribed topic updates ──────────────────────────────────────────────

  const subscribedTopicIds = (subscriptionsRes.data ?? []).map((s) => s.topic_id)
  let subscribedUpdates: BriefingSubscribedUpdate[] = []

  if (subscribedTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('id', subscribedTopicIds)
      .gte('updated_at', sevenDaysAgo)
      .order('updated_at', { ascending: false })
      .limit(6)

    subscribedUpdates = (topicRows ?? []).map((t) => ({
      topic_id: t.id,
      statement: t.statement,
      category: t.category,
      old_status: null,
      new_status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      updated_at: t.updated_at,
    }))
  }

  // ── Upcoming debates with participant counts ──────────────────────────────

  const rawDebates = debatesRes.data ?? []
  const debateIds = rawDebates.map((d) => d.id)

  const participantCounts: Record<string, number> = {}
  if (debateIds.length > 0) {
    const { data: parts } = await supabase
      .from('debate_participants')
      .select('debate_id')
      .in('debate_id', debateIds)

    for (const p of parts ?? []) {
      participantCounts[p.debate_id] = (participantCounts[p.debate_id] ?? 0) + 1
    }
  }

  // Fetch topic statements for debates that have a topic_id
  const debateTopicIds = rawDebates.map((d) => d.topic_id).filter(Boolean) as string[]
  const debateTopicMap: Record<string, string> = {}
  if (debateTopicIds.length > 0) {
    const { data: debTopics } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', debateTopicIds)
    for (const t of debTopics ?? []) {
      debateTopicMap[t.id] = t.statement
    }
  }

  const upcomingDebates: BriefingDebate[] = rawDebates.map((d) => ({
    id: d.id,
    title: d.title,
    topic_id: d.topic_id,
    topic_statement: d.topic_id ? (debateTopicMap[d.topic_id] ?? null) : null,
    scheduled_at: d.scheduled_at,
    debate_type: d.debate_type,
    status: d.status,
    participant_count: participantCounts[d.id] ?? 0,
  }))

  // ── Top category from user's recent votes ─────────────────────────────────

  const recentVoteTopicIds = (topCategoryRes.data ?? []).map((v) => v.topic_id)
  let topCategory: string | null = null

  if (recentVoteTopicIds.length > 0) {
    const { data: votedTopics } = await supabase
      .from('topics')
      .select('category')
      .in('id', recentVoteTopicIds)

    const catCounts: Record<string, number> = {}
    for (const t of votedTopics ?? []) {
      if (t.category) catCounts[t.category] = (catCounts[t.category] ?? 0) + 1
    }
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1])
    topCategory = sorted[0]?.[0] ?? null
  }

  // ── Featured argument ─────────────────────────────────────────────────────

  let featuredArgument: BriefingFeaturedArgument | null = null
  {
    let argQuery = supabase
      .from('arguments')
      .select('id, topic_id, side, content, upvotes, user_id, created_at')
      .gte('created_at', sevenDaysAgo)
      .order('upvotes', { ascending: false })
      .limit(1)

    // Prefer arguments in the user's top category
    if (topCategory) {
      const { data: catTopics } = await supabase
        .from('topics')
        .select('id')
        .eq('category', topCategory)
        .in('status', ['active', 'voting', 'law'])
        .limit(30)

      const catTopicIds = (catTopics ?? []).map((t) => t.id)
      if (catTopicIds.length > 0) {
        argQuery = supabase
          .from('arguments')
          .select('id, topic_id, side, content, upvotes, user_id, created_at')
          .in('topic_id', catTopicIds)
          .gte('created_at', sevenDaysAgo)
          .order('upvotes', { ascending: false })
          .limit(1)
      }
    }

    const { data: argRows } = await argQuery
    const arg = argRows?.[0]

    if (arg) {
      const [topicRes, authorRes] = await Promise.all([
        supabase
          .from('topics')
          .select('statement, category')
          .eq('id', arg.topic_id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', arg.user_id)
          .maybeSingle(),
      ])

      if (topicRes.data && authorRes.data) {
        featuredArgument = {
          id: arg.id,
          topic_id: arg.topic_id,
          topic_statement: topicRes.data.statement,
          category: topicRes.data.category,
          side: arg.side as 'blue' | 'red',
          content: arg.content.slice(0, 300) + (arg.content.length > 300 ? '…' : ''),
          upvotes: arg.upvotes ?? 0,
          author_username: authorRes.data.username,
          author_display_name: authorRes.data.display_name,
          author_avatar_url: authorRes.data.avatar_url,
        }
      }
    }
  }

  // ── Platform highlights ───────────────────────────────────────────────────

  const highlights: BriefingHighlight[] = []

  // Trending topic (highest feed_score active right now)
  const { data: trendingTopic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, feed_score')
    .eq('status', 'active')
    .order('feed_score', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (trendingTopic) {
    highlights.push({
      type: 'trending_topic',
      topic_id: trendingTopic.id,
      statement: trendingTopic.statement,
      category: trendingTopic.category,
      blue_pct: trendingTopic.blue_pct ?? 50,
      total_votes: trendingTopic.total_votes ?? 0,
    })
  }

  // Most recently established law
  const { data: recentLaw } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes')
    .eq('status', 'law')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentLaw) {
    highlights.push({
      type: 'new_law',
      topic_id: recentLaw.id,
      statement: recentLaw.statement,
      category: recentLaw.category,
      blue_pct: recentLaw.blue_pct ?? 50,
      total_votes: recentLaw.total_votes ?? 0,
    })
  }

  return NextResponse.json({
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      vote_streak: profile.vote_streak ?? 0,
      clout: profile.clout ?? 0,
      daily_votes_used: profile.daily_votes_used ?? 0,
      daily_limit: dailyLimit,
    },
    subscribed_updates: subscribedUpdates,
    upcoming_debates: upcomingDebates,
    featured_argument: featuredArgument,
    highlights,
    unread_notification_count: notificationsRes.count ?? 0,
    top_category: topCategory,
  } satisfies BriefingData)
}
