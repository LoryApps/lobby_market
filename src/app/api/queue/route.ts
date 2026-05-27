import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'vote_urgent'
  | 'vote_recommended'
  | 'argue'
  | 'debate_rsvp'
  | 'predict'
  | 'complete_profile'
  | 'join_coalition'
  | 'daily_goal'

export interface QueueAction {
  id: string
  type: ActionType
  priority: number          // 1 (highest) – 5 (lowest)
  title: string
  description: string
  href: string
  meta?: {
    topic_id?: string
    topic_statement?: string
    topic_category?: string | null
    topic_status?: string
    blue_pct?: number
    total_votes?: number
    ends_at?: string | null
    debate_id?: string
    debate_title?: string
    scheduled_at?: string
    votes_used?: number
    daily_limit?: number
    completion_pct?: number
  }
}

export interface QueueResponse {
  actions: QueueAction[]
  profile_complete: boolean
  daily_votes_used: number
  daily_limit: number
  total_urgent: number
}

// ─── GET /api/queue ───────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const actions: QueueAction[] = []

  // ── 1. Fetch user profile ──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'daily_votes_used, daily_votes_reset_at, category_preferences, bio, avatar_url, display_name, total_votes, onboarding_complete'
    )
    .eq('id', user.id)
    .single()

  const dailyVotesUsed = profile?.daily_votes_used ?? 0
  const dailyLimit = 10
  const categories: string[] = profile?.category_preferences ?? []

  // ── 2. Daily goal action ────────────────────────────────────────────────────
  if (dailyVotesUsed < dailyLimit) {
    const remaining = dailyLimit - dailyVotesUsed
    actions.push({
      id: 'daily-goal',
      type: 'daily_goal',
      priority: dailyVotesUsed === 0 ? 1 : 2,
      title: dailyVotesUsed === 0 ? 'Cast your first vote today' : `${remaining} vote${remaining !== 1 ? 's' : ''} to reach your daily goal`,
      description:
        dailyVotesUsed === 0
          ? 'You haven\'t voted yet today. Vote to keep your streak alive.'
          : `You\'ve cast ${dailyVotesUsed}/${dailyLimit} votes today. ${remaining} more to hit your daily goal.`,
      href: '/',
      meta: { votes_used: dailyVotesUsed, daily_limit: dailyLimit },
    })
  }

  // ── 3. Voting in progress topics (final voting — most urgent) ──────────────
  const { data: votingTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at')
    .eq('status', 'voting')
    .order('voting_ends_at', { ascending: true })
    .limit(15)

  if (votingTopics && votingTopics.length > 0) {
    // Filter out topics user already voted on
    const votingIds = votingTopics.map((t) => t.id)
    const { data: userVotesOnVoting } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', votingIds)

    const votedIds = new Set((userVotesOnVoting ?? []).map((v) => v.topic_id))

    for (const t of votingTopics) {
      if (votedIds.has(t.id)) continue
      const endsAt = (t as { voting_ends_at?: string | null }).voting_ends_at
      const hoursLeft = endsAt
        ? Math.max(0, (new Date(endsAt).getTime() - Date.now()) / 3_600_000)
        : null

      actions.push({
        id: `vote-urgent-${t.id}`,
        type: 'vote_urgent',
        priority: 1,
        title: 'Vote before the window closes',
        description:
          hoursLeft !== null && hoursLeft < 24
            ? `Voting closes in ${hoursLeft < 1 ? 'less than 1h' : `~${Math.round(hoursLeft)}h`} — your vote still counts.`
            : 'This topic is in its final voting phase.',
        href: `/topic/${t.id}`,
        meta: {
          topic_id: t.id,
          topic_statement: t.statement,
          topic_category: t.category,
          topic_status: t.status,
          blue_pct: t.blue_pct ?? 50,
          total_votes: t.total_votes ?? 0,
          ends_at: endsAt ?? null,
        },
      })

      if (actions.filter((a) => a.type === 'vote_urgent').length >= 3) break
    }
  }

  // ── 4. Recommended active topics the user hasn't voted on ─────────────────
  const { data: activeTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score')
    .eq('status', 'active')
    .in(categories.length > 0 ? 'category' : 'status', categories.length > 0 ? categories : ['active'])
    .order('feed_score', { ascending: false })
    .limit(20)

  if (activeTopics && activeTopics.length > 0) {
    const activeIds = activeTopics.map((t) => t.id)
    const { data: userVotesOnActive } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', activeIds)

    const votedActiveIds = new Set((userVotesOnActive ?? []).map((v) => v.topic_id))

    let recommendedCount = 0
    for (const t of activeTopics) {
      if (votedActiveIds.has(t.id)) continue
      actions.push({
        id: `vote-recommended-${t.id}`,
        type: 'vote_recommended',
        priority: 3,
        title: 'Weigh in on an active debate',
        description: t.category
          ? `A ${t.category.toLowerCase()} topic is gaining momentum and needs your vote.`
          : 'An active debate needs your voice.',
        href: `/topic/${t.id}`,
        meta: {
          topic_id: t.id,
          topic_statement: t.statement,
          topic_category: t.category,
          topic_status: t.status,
          blue_pct: t.blue_pct ?? 50,
          total_votes: t.total_votes ?? 0,
        },
      })
      recommendedCount++
      if (recommendedCount >= 3) break
    }
  }

  // ── 5. Topics the user voted on but hasn't argued ─────────────────────────
  const { data: userVotedTopics } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)
    .limit(50)

  if (userVotedTopics && userVotedTopics.length > 0) {
    const votedTopicIds = userVotedTopics.map((v) => v.topic_id)

    const { data: arguedTopics } = await supabase
      .from('topic_arguments')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', votedTopicIds)

    const arguedIds = new Set((arguedTopics ?? []).map((a) => a.topic_id))

    const needsArgumentIds = votedTopicIds.filter((id) => !arguedIds.has(id))

    if (needsArgumentIds.length > 0) {
      const { data: argTopics } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('id', needsArgumentIds.slice(0, 10))
        .in('status', ['active', 'voting'])
        .order('total_votes', { ascending: false })
        .limit(2)

      for (const t of argTopics ?? []) {
        actions.push({
          id: `argue-${t.id}`,
          type: 'argue',
          priority: 3,
          title: 'Back your vote with an argument',
          description: 'You voted on this topic but haven\'t made a case yet. A strong argument earns clout and shifts minds.',
          href: `/topic/${t.id}/argue`,
          meta: {
            topic_id: t.id,
            topic_statement: t.statement,
            topic_category: t.category,
            topic_status: t.status,
            blue_pct: t.blue_pct ?? 50,
            total_votes: t.total_votes ?? 0,
          },
        })
      }
    }
  }

  // ── 6. Upcoming debates without RSVP ──────────────────────────────────────
  const in48h = new Date(Date.now() + 48 * 3_600_000).toISOString()
  const { data: upcomingDebates } = await supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, topic_id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', in48h)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (upcomingDebates && upcomingDebates.length > 0) {
    const debateIds = upcomingDebates.map((d) => d.id)
    const { data: myRsvps } = await supabase
      .from('debate_rsvps')
      .select('debate_id')
      .eq('user_id', user.id)
      .in('debate_id', debateIds)

    const rsvpdIds = new Set((myRsvps ?? []).map((r) => r.debate_id))

    for (const d of upcomingDebates) {
      if (rsvpdIds.has(d.id)) continue

      // Get topic statement
      let topicStatement = ''
      let topicCategory: string | null = null
      if (d.topic_id) {
        const { data: debateTopic } = await supabase
          .from('topics')
          .select('statement, category')
          .eq('id', d.topic_id)
          .single()
        topicStatement = debateTopic?.statement ?? ''
        topicCategory = debateTopic?.category ?? null
      }

      const hoursUntil = (new Date(d.scheduled_at).getTime() - Date.now()) / 3_600_000
      actions.push({
        id: `debate-rsvp-${d.id}`,
        type: 'debate_rsvp',
        priority: 2,
        title: 'RSVP to an upcoming debate',
        description: `"${d.title}" starts in ${hoursUntil < 1 ? 'less than 1h' : `~${Math.round(hoursUntil)}h`}. Reserve your spot as a spectator.`,
        href: `/debate/${d.id}`,
        meta: {
          debate_id: d.id,
          debate_title: d.title,
          scheduled_at: d.scheduled_at,
          topic_id: d.topic_id ?? undefined,
          topic_statement: topicStatement,
          topic_category: topicCategory,
        },
      })

      if (actions.filter((a) => a.type === 'debate_rsvp').length >= 2) break
    }
  }

  // ── 7. Active topics without predictions ──────────────────────────────────
  if ((profile?.total_votes ?? 0) >= 5) {
    const { data: predictableTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(20)

    if (predictableTopics && predictableTopics.length > 0) {
      const predIds = predictableTopics.map((t) => t.id)
      const { data: myPredictions } = await supabase
        .from('topic_predictions')
        .select('topic_id')
        .eq('user_id', user.id)
        .in('topic_id', predIds)

      const predictedIds = new Set((myPredictions ?? []).map((p) => p.topic_id))

      let predCount = 0
      for (const t of predictableTopics) {
        if (predictedIds.has(t.id)) continue
        actions.push({
          id: `predict-${t.id}`,
          type: 'predict',
          priority: 4,
          title: 'Make a prediction',
          description: 'Will this become law? Stake your civic credibility and earn clout if you\'re right.',
          href: `/topic/${t.id}#predictions`,
          meta: {
            topic_id: t.id,
            topic_statement: t.statement,
            topic_category: t.category,
            topic_status: t.status,
            blue_pct: t.blue_pct ?? 50,
            total_votes: t.total_votes ?? 0,
          },
        })
        predCount++
        if (predCount >= 2) break
      }
    }
  }

  // ── 8. Profile completion ──────────────────────────────────────────────────
  const hasAvatar = !!profile?.avatar_url
  const hasBio = !!profile?.bio && (profile.bio as string).length > 10
  const hasDisplayName = !!profile?.display_name

  const missingFields: string[] = []
  if (!hasDisplayName) missingFields.push('display name')
  if (!hasAvatar) missingFields.push('profile photo')
  if (!hasBio) missingFields.push('bio')

  const completionPct = Math.round(
    ((hasDisplayName ? 1 : 0) + (hasAvatar ? 1 : 0) + (hasBio ? 1 : 0)) / 3 * 100
  )
  const profileComplete = completionPct === 100

  if (!profileComplete) {
    actions.push({
      id: 'complete-profile',
      type: 'complete_profile',
      priority: 5,
      title: 'Complete your profile',
      description: `Add your ${missingFields.join(' and ')} to build trust and earn more clout.`,
      href: '/profile/settings',
      meta: { completion_pct: completionPct },
    })
  }

  // ── Sort by priority then type ─────────────────────────────────────────────
  actions.sort((a, b) => a.priority - b.priority)

  const totalUrgent = actions.filter((a) => a.type === 'vote_urgent').length

  return NextResponse.json({
    actions: actions.slice(0, 12),
    profile_complete: profileComplete,
    daily_votes_used: dailyVotesUsed,
    daily_limit: dailyLimit,
    total_urgent: totalUrgent,
  } satisfies QueueResponse)
}
