import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/for-you
 *
 * Personalized recommendations for the logged-in user:
 *   - Topics to vote on (unvoted, matching category preferences)
 *   - People to follow (high-rep users not yet followed)
 *   - Coalitions to consider (active coalitions in preferred categories)
 *   - Upcoming debates (next 72h, in preferred categories)
 */

export interface ForYouTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
}

export interface ForYouPerson {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  bio: string | null
  total_votes: number
}

export interface ForYouCoalition {
  id: string
  name: string
  description: string | null
  member_count: number
  category: string | null
  clout_total: number
  is_public: boolean
}

export interface ForYouDebate {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  scheduled_at: string
  host_username: string | null
  host_display_name: string | null
  host_avatar_url: string | null
  rsvp_count: number
}

export interface ForYouResponse {
  topics: ForYouTopic[]
  people: ForYouPerson[]
  coalitions: ForYouCoalition[]
  debates: ForYouDebate[]
  categoryPreferences: string[]
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated — return global trending
  if (!user) {
    const { data: trending } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .in('status', ['active', 'proposed', 'voting'])
      .order('view_count', { ascending: false })
      .limit(6)

    return NextResponse.json({
      topics: trending ?? [],
      people: [],
      coalitions: [],
      debates: [],
      categoryPreferences: [],
    } satisfies ForYouResponse)
  }

  // Fetch user profile (preferences + voting history)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, category_preferences')
    .eq('id', user.id)
    .single()

  const categoryPreferences: string[] =
    (profile?.category_preferences as string[] | null) ?? []

  // ── 1. Topics to vote on ─────────────────────────────────────────────────────
  // Find topics the user hasn't voted on yet, matching their categories
  const { data: userVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)
    .limit(1000)

  const votedTopicIds = (userVotes ?? []).map((v) => v.topic_id)

  let topicQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
    .in('status', ['active', 'proposed', 'voting'])
    .order('view_count', { ascending: false })
    .limit(50)

  if (categoryPreferences.length > 0) {
    topicQuery = topicQuery.in('category', categoryPreferences)
  }

  const { data: candidateTopics } = await topicQuery

  const unvotedTopics = (candidateTopics ?? [])
    .filter((t) => !votedTopicIds.includes(t.id))
    .slice(0, 8) as ForYouTopic[]

  // ── 2. People to follow ──────────────────────────────────────────────────────
  const { data: following } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .limit(500)

  const followingIds = (following ?? []).map((f) => f.following_id)
  const excludePeopleIds = [user.id, ...followingIds]

  let peopleQuery = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, bio, total_votes')
    .gt('total_votes', 5)
    .order('reputation_score', { ascending: false })
    .limit(excludePeopleIds.length + 15)

  if (excludePeopleIds.length > 0) {
    peopleQuery = peopleQuery.not('id', 'in', `(${excludePeopleIds.join(',')})`)
  }

  const { data: peopleCandidates } = await peopleQuery
  const people = ((peopleCandidates ?? []) as ForYouPerson[]).slice(0, 5)

  // ── 3. Coalitions to consider ────────────────────────────────────────────────
  // Coalitions the user is NOT a member of
  const { data: myCoalitions } = await supabase
    .from('coalition_members')
    .select('coalition_id')
    .eq('user_id', user.id)

  const myCoalitionIds = (myCoalitions ?? []).map((m) => m.coalition_id)

  let coalitionQuery = supabase
    .from('coalitions')
    .select('id, name, description, member_count, category, clout_total, is_public')
    .eq('is_public', true)
    .eq('recruiting', true)
    .order('member_count', { ascending: false })
    .limit(myCoalitionIds.length + 10)

  if (myCoalitionIds.length > 0) {
    coalitionQuery = coalitionQuery.not('id', 'in', `(${myCoalitionIds.join(',')})`)
  }

  if (categoryPreferences.length > 0) {
    coalitionQuery = coalitionQuery.in('category', categoryPreferences)
  }

  const { data: coalitionCandidates } = await coalitionQuery
  const coalitions = ((coalitionCandidates ?? []) as ForYouCoalition[]).slice(0, 4)

  // ── 4. Upcoming debates ──────────────────────────────────────────────────────
  const in72h = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { data: upcomingDebates } = await supabase
    .from('debates')
    .select(`
      id,
      topic_id,
      scheduled_at,
      rsvp_count,
      topics!inner (
        statement,
        category
      ),
      profiles:host_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('status', 'scheduled')
    .gt('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', in72h)
    .order('scheduled_at', { ascending: true })
    .limit(30)

  const debates: ForYouDebate[] = ((upcomingDebates ?? []) as Array<{
    id: string
    topic_id: string
    scheduled_at: string
    rsvp_count: number | null
    topics: { statement: string; category: string | null } | null
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
  }>)
    .filter((d) => {
      if (categoryPreferences.length === 0) return true
      return d.topics && categoryPreferences.includes(d.topics.category ?? '')
    })
    .slice(0, 4)
    .map((d) => ({
      id: d.id,
      topic_id: d.topic_id,
      topic_statement: d.topics?.statement ?? '',
      topic_category: d.topics?.category ?? null,
      scheduled_at: d.scheduled_at,
      host_username: d.profiles?.username ?? null,
      host_display_name: d.profiles?.display_name ?? null,
      host_avatar_url: d.profiles?.avatar_url ?? null,
      rsvp_count: d.rsvp_count ?? 0,
    }))

  return NextResponse.json({
    topics: unvotedTopics,
    people,
    coalitions,
    debates,
    categoryPreferences,
  } satisfies ForYouResponse)
}
