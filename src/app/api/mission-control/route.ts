import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MissionTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  has_voted: boolean
}

export interface MissionPrediction {
  id: string
  topic_id: string
  statement: string
  predicted_law: boolean
  confidence: number
  status: string
  voting_ends_at: string | null
  resolved_at: string | null
  correct: boolean | null
}

export interface MissionDebate {
  id: string
  topic_id: string
  statement: string
  status: string
  scheduled_at: string | null
  rsvp: 'for' | 'against' | null
}

export interface MissionAchievement {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  tier: string
  earned_at: string
}

export interface MissionNotification {
  id: string
  type: string
  title: string
  body: string | null
  reference_id: string | null
  reference_type: string | null
  is_read: boolean
  created_at: string
}

export interface MissionControlData {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    total_votes: number
    vote_streak: number
    daily_votes_used: number
  } | null
  // Topics awaiting the user's vote
  pending_votes: MissionTopic[]
  // User's active predictions (unresolved)
  active_predictions: MissionPrediction[]
  // Upcoming and live debates the user has RSVPd to
  my_debates: MissionDebate[]
  // Recent unread notifications (last 5)
  recent_notifications: MissionNotification[]
  // Recently earned achievements
  recent_achievements: MissionAchievement[]
  // Platform pulse
  pulse: {
    active_topics: number
    laws_passed_today: number
    live_debates: number
    total_voters_today: number
  }
  // Quick stats
  stats: {
    topics_voted_today: number
    streak_days: number
    leaderboard_rank: number | null
    accuracy_pct: number | null
  }
}

// ─── GET /api/mission-control ─────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // ── Parallel data fetches ──────────────────────────────────────────────────
    const [
      profileRes,
      activeTopicsRes,
      myVotesRes,
      predictionsRes,
      debatesRes,
      notifsRes,
      achievementsRes,
      lawsTodayRes,
      liveDebatesRes,
    ] = await Promise.all([
      // Profile
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, vote_streak, daily_votes_used')
        .eq('id', user.id)
        .single(),

      // Active/voting topics (up to 20, sorted by feed_score)
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at')
        .in('status', ['active', 'voting'])
        .order('feed_score', { ascending: false })
        .limit(20),

      // Topics the user has already voted on
      supabase
        .from('votes')
        .select('topic_id')
        .eq('user_id', user.id),

      // User's unresolved predictions
      supabase
        .from('topic_predictions')
        .select('id, topic_id, predicted_law, confidence, resolved_at, correct, created_at')
        .eq('user_id', user.id)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(5),

      // Debates user has RSVP'd to (upcoming + live)
      supabase
        .from('debate_rsvps')
        .select('debate_id')
        .eq('user_id', user.id)
        .limit(10),

      // Recent unread notifications
      supabase
        .from('notifications')
        .select('id, type, title, body, reference_id, reference_type, is_read, created_at')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5),

      // Recent achievements (last 3 earned)
      supabase
        .from('user_achievements')
        .select('earned_at, achievements(id, slug, name, description, icon, tier)')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
        .limit(3),

      // Laws established today
      supabase
        .from('laws')
        .select('id', { count: 'exact', head: true })
        .gte('established_at', todayISO),

      // Live debates count
      supabase
        .from('debates')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'live'),
    ])

    const profile = profileRes.data ?? null
    const activeTopics = activeTopicsRes.data ?? []
    const myVotedIds = new Set((myVotesRes.data ?? []).map((v) => v.topic_id))

    // ── Topics pending the user's vote ─────────────────────────────────────────
    const pending_votes: MissionTopic[] = activeTopics
      .filter((t) => !myVotedIds.has(t.id))
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        voting_ends_at: t.voting_ends_at,
        has_voted: false,
      }))

    // ── Active predictions with topic statements ───────────────────────────────
    const rawPredictions = predictionsRes.data ?? []
    let active_predictions: MissionPrediction[] = []
    if (rawPredictions.length > 0) {
      const topicIds = rawPredictions.map((p) => p.topic_id)
      const { data: predTopics } = await supabase
        .from('topics')
        .select('id, statement, status, voting_ends_at')
        .in('id', topicIds)
      const topicMap = new Map((predTopics ?? []).map((t) => [t.id, t]))

      active_predictions = rawPredictions.map((p) => ({
        id: p.id,
        topic_id: p.topic_id,
        statement: topicMap.get(p.topic_id)?.statement ?? 'Unknown topic',
        predicted_law: p.predicted_law,
        confidence: p.confidence,
        status: topicMap.get(p.topic_id)?.status ?? 'unknown',
        voting_ends_at: topicMap.get(p.topic_id)?.voting_ends_at ?? null,
        resolved_at: p.resolved_at,
        correct: p.correct,
      }))
    }

    // ── Debates with RSVP ──────────────────────────────────────────────────────
    const rsvpRows = debatesRes.data ?? []
    let my_debates: MissionDebate[] = []
    if (rsvpRows.length > 0) {
      const debateIds = rsvpRows.map((r) => r.debate_id)
      const { data: debateRows } = await supabase
        .from('debates')
        .select('id, topic_id, status, scheduled_at')
        .in('id', debateIds)
        .in('status', ['scheduled', 'live'])
        .order('scheduled_at', { ascending: true })
        .limit(5)

      if (debateRows && debateRows.length > 0) {
        const debTopicIds = debateRows.map((d) => d.topic_id).filter(Boolean)
        const { data: debTopics } = debTopicIds.length
          ? await supabase
              .from('topics')
              .select('id, statement')
              .in('id', debTopicIds)
          : { data: [] }
        const debTopicMap = new Map((debTopics ?? []).map((t) => [t.id, t]))
        my_debates = debateRows.map((d) => ({
          id: d.id,
          topic_id: d.topic_id,
          statement: debTopicMap.get(d.topic_id)?.statement ?? 'Debate',
          status: d.status,
          scheduled_at: d.scheduled_at,
          rsvp: null,
        }))
      }
    }

    // ── Recent notifications ───────────────────────────────────────────────────
    const recent_notifications: MissionNotification[] = (notifsRes.data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      reference_id: n.reference_id,
      reference_type: n.reference_type,
      is_read: n.is_read,
      created_at: n.created_at,
    }))

    // ── Recent achievements ────────────────────────────────────────────────────
    const recent_achievements: MissionAchievement[] = (achievementsRes.data ?? [])
      .filter((ua) => ua.achievements)
      .map((ua) => {
        const ach = ua.achievements as {
          id: string
          slug: string
          name: string
          description: string
          icon: string
          tier: string
        }
        return {
          id: ach.id,
          slug: ach.slug,
          name: ach.name,
          description: ach.description,
          icon: ach.icon,
          tier: ach.tier,
          earned_at: ua.earned_at,
        }
      })

    // ── Leaderboard rank ──────────────────────────────────────────────────────
    let leaderboard_rank: number | null = null
    if (profile) {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('reputation_score', profile.reputation_score)
      leaderboard_rank = count !== null ? count + 1 : null
    }

    // ── Accuracy % from resolved predictions ─────────────────────────────────
    let accuracy_pct: number | null = null
    const { data: resolvedPreds } = await supabase
      .from('topic_predictions')
      .select('correct')
      .eq('user_id', user.id)
      .not('resolved_at', 'is', null)

    if (resolvedPreds && resolvedPreds.length > 0) {
      const correct = resolvedPreds.filter((p) => p.correct === true).length
      accuracy_pct = Math.round((correct / resolvedPreds.length) * 100)
    }

    // ── Votes today ───────────────────────────────────────────────────────────
    const { count: votesToday } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayISO)

    // ── Pulse: active topics count ────────────────────────────────────────────
    const { count: activeTopicCount } = await supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'voting'])

    const result: MissionControlData = {
      profile,
      pending_votes,
      active_predictions,
      my_debates,
      recent_notifications,
      recent_achievements,
      pulse: {
        active_topics: activeTopicCount ?? 0,
        laws_passed_today: lawsTodayRes.count ?? 0,
        live_debates: liveDebatesRes.count ?? 0,
        total_voters_today: 0,
      },
      stats: {
        topics_voted_today: votesToday ?? 0,
        streak_days: profile?.vote_streak ?? 0,
        leaderboard_rank,
        accuracy_pct,
      },
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[mission-control] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
