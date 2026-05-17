import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type JourneyEventType =
  | 'joined'
  | 'first_vote'
  | 'vote_milestone'
  | 'first_argument'
  | 'argument_milestone'
  | 'first_debate'
  | 'law_voted'
  | 'achievement'
  | 'first_prediction'
  | 'clout_milestone'
  | 'streak_milestone'
  | 'archetype_set'

export interface JourneyEvent {
  id: string
  type: JourneyEventType
  date: string
  title: string
  description: string
  highlight: boolean
  // Optional context
  topic_id?: string
  topic_statement?: string
  achievement_name?: string
  achievement_tier?: string
  count?: number
}

export interface JourneyStats {
  joined_at: string
  total_votes: number
  total_arguments: number
  clout: number
  vote_streak: number
  civic_archetype: string | null
  days_as_member: number
}

export interface JourneyResponse {
  authenticated: true
  events: JourneyEvent[]
  stats: JourneyStats
}

// ─── GET /api/analytics/journey ───────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, created_at, total_votes, total_arguments, clout, vote_streak, civic_archetype, reputation_score'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const events: JourneyEvent[] = []

  // ── Joined event ───────────────────────────────────────────────────────────
  events.push({
    id: 'joined',
    type: 'joined',
    date: profile.created_at,
    title: 'Entered the Lobby',
    description: 'Your civic journey began. The platform was yours to shape.',
    highlight: true,
  })

  // ── First vote ─────────────────────────────────────────────────────────────
  const { data: firstVoteRow } = await supabase
    .from('votes')
    .select('created_at, side, topic_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstVoteRow) {
    const topicId = firstVoteRow.topic_id as string | null
    let topicStatement: string | undefined
    if (topicId) {
      const { data: t } = await supabase
        .from('topics')
        .select('statement')
        .eq('id', topicId)
        .maybeSingle()
      topicStatement = t?.statement
    }
    events.push({
      id: 'first_vote',
      type: 'first_vote',
      date: firstVoteRow.created_at as string,
      title: 'Cast Your First Vote',
      description: topicStatement
        ? `You took a stand on "${topicStatement.slice(0, 80)}${topicStatement.length > 80 ? '…' : ''}".`
        : 'You exercised your civic voice for the first time.',
      highlight: true,
      topic_id: topicId ?? undefined,
      topic_statement: topicStatement,
    })
  }

  // ── Vote count milestones ──────────────────────────────────────────────────
  const VOTE_MILESTONES = [10, 50, 100, 250, 500, 1000, 2500, 5000]
  const totalVotes = profile.total_votes ?? 0

  // We need the dates at which the user hit these counts.
  // Efficiently: fetch up to max(milestone) + 1 vote rows ordered by date.
  const maxMilestone = VOTE_MILESTONES.filter((m) => m <= totalVotes).slice(-1)[0]
  if (maxMilestone) {
    const { data: voteRows } = await supabase
      .from('votes')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(maxMilestone)

    if (voteRows) {
      for (const milestone of VOTE_MILESTONES) {
        if (milestone <= voteRows.length) {
          const row = voteRows[milestone - 1]
          if (row) {
            events.push({
              id: `vote_milestone_${milestone}`,
              type: 'vote_milestone',
              date: row.created_at as string,
              title: `${milestone.toLocaleString()} Votes Cast`,
              description: `A civic ${milestone >= 1000 ? 'powerhouse' : milestone >= 100 ? 'veteran' : 'regular'} — you've shaped ${milestone.toLocaleString()} policy decisions.`,
              highlight: milestone >= 100,
              count: milestone,
            })
          }
        }
      }
    }
  }

  // ── First argument ─────────────────────────────────────────────────────────
  const { data: firstArgRow } = await supabase
    .from('topic_arguments')
    .select('id, created_at, topic_id, content, side, upvotes')
    .eq('author_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstArgRow) {
    const topicId = firstArgRow.topic_id as string | null
    let topicStatement: string | undefined
    if (topicId) {
      const { data: t } = await supabase
        .from('topics')
        .select('statement')
        .eq('id', topicId)
        .maybeSingle()
      topicStatement = t?.statement
    }
    events.push({
      id: 'first_argument',
      type: 'first_argument',
      date: firstArgRow.created_at as string,
      title: 'Wrote Your First Argument',
      description: topicStatement
        ? `You made the case on "${topicStatement.slice(0, 70)}${topicStatement.length > 70 ? '…' : ''}".`
        : 'You moved from voter to advocate.',
      highlight: true,
      topic_id: topicId ?? undefined,
      topic_statement: topicStatement,
    })
  }

  // ── Argument count milestone ───────────────────────────────────────────────
  const totalArgs = profile.total_arguments ?? 0
  const ARG_MILESTONES = [10, 25, 50, 100]
  for (const milestone of ARG_MILESTONES) {
    if (totalArgs >= milestone) {
      const { data: argMRow } = await supabase
        .from('topic_arguments')
        .select('created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: true })
        .range(milestone - 1, milestone - 1)
        .maybeSingle()
      if (argMRow) {
        events.push({
          id: `arg_milestone_${milestone}`,
          type: 'argument_milestone',
          date: argMRow.created_at as string,
          title: `${milestone} Arguments Written`,
          description: `Your ${milestone}th argument hit the floor. You've become a voice the Lobby reckons with.`,
          highlight: milestone >= 50,
          count: milestone,
        })
      }
    }
  }

  // ── First debate ───────────────────────────────────────────────────────────
  const { data: firstDebateRow } = await supabase
    .from('debate_participants')
    .select('created_at, debate_id, side, is_speaker')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstDebateRow) {
    events.push({
      id: 'first_debate',
      type: 'first_debate',
      date: firstDebateRow.created_at as string,
      title: firstDebateRow.is_speaker ? 'Took the Podium' : 'Joined Your First Debate',
      description: firstDebateRow.is_speaker
        ? 'You stood up as a speaker in a live civic debate. Your voice echoed the chamber.'
        : 'You entered the arena as a spectator, watching civic discourse unfold in real-time.',
      highlight: !!firstDebateRow.is_speaker,
    })
  }

  // ── First prediction ───────────────────────────────────────────────────────
  const { data: firstPredRow } = await supabase
    .from('topic_predictions')
    .select('created_at, topic_id, predicted_outcome, clout_staked')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstPredRow) {
    events.push({
      id: 'first_prediction',
      type: 'first_prediction',
      date: firstPredRow.created_at as string,
      title: 'Made Your First Prediction',
      description: `You staked ${firstPredRow.clout_staked ?? 0} clout on a civic outcome. The oracle has spoken.`,
      highlight: false,
    })
  }

  // ── Voted on a topic that became law ──────────────────────────────────────
  const { data: lawVotes } = await supabase
    .from('votes')
    .select('created_at, topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(500)

  if (lawVotes && lawVotes.length > 0) {
    const topicIds = lawVotes.map((v) => v.topic_id as string)
    const { data: lawTopics } = await supabase
      .from('topics')
      .select('id, statement, status, blue_pct')
      .in('id', topicIds)
      .eq('status', 'law')
      .limit(5)

    if (lawTopics && lawTopics.length > 0) {
      for (const law of lawTopics.slice(0, 3)) {
        const vote = lawVotes.find((v) => v.topic_id === law.id)
        if (!vote) continue
        const wonSide = (law.blue_pct ?? 50) >= 50 ? 'blue' : 'red'
        const userWon = vote.side === wonSide
        events.push({
          id: `law_voted_${law.id}`,
          type: 'law_voted',
          date: vote.created_at as string,
          title: `Voted on "${law.statement.slice(0, 60)}${law.statement.length > 60 ? '…' : ''}"`,
          description: userWon
            ? 'Your vote carried the day. This topic became law with your support.'
            : 'You cast your vote. Though the outcome differed, your voice was heard in the Codex.',
          highlight: userWon,
          topic_id: law.id,
          topic_statement: law.statement,
        })
      }
    }
  }

  // ── Achievements earned ────────────────────────────────────────────────────
  const { data: earnedRows } = await supabase
    .from('user_achievements')
    .select('earned_at, achievement_id')
    .eq('user_id', user.id)
    .order('earned_at', { ascending: true })
    .limit(20)

  if (earnedRows && earnedRows.length > 0) {
    const achievementIds = earnedRows.map((r) => r.achievement_id)
    const { data: achievementDefs } = await supabase
      .from('achievements')
      .select('id, name, tier')
      .in('id', achievementIds)

    const defMap = new Map(
      (achievementDefs ?? []).map((a) => [a.id, a])
    )

    for (const row of earnedRows) {
      const def = defMap.get(row.achievement_id)
      if (!def) continue
      const tier = def.tier as string
      const isHighTier = tier === 'legendary' || tier === 'epic'
      events.push({
        id: `achievement_${row.achievement_id}`,
        type: 'achievement',
        date: row.earned_at as string,
        title: `Earned: ${def.name}`,
        description: `${isHighTier ? '✦ ' : ''}A ${tier} achievement unlocked. Your civic reputation grew.`,
        highlight: isHighTier,
        achievement_name: def.name,
        achievement_tier: tier,
      })
    }
  }

  // ── Archetype assigned ─────────────────────────────────────────────────────
  if (profile.civic_archetype) {
    // Estimate: archetype is set when user has enough votes (~5 votes minimum)
    // We use the date of the 5th vote as the proxy.
    const { data: fifthVote } = await supabase
      .from('votes')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .range(4, 4)
      .maybeSingle()

    if (fifthVote) {
      events.push({
        id: 'archetype_set',
        type: 'archetype_set',
        date: fifthVote.created_at as string,
        title: `Civic Archetype: ${profile.civic_archetype}`,
        description: 'After weighing your positions, the Lobby assigned your civic identity.',
        highlight: false,
      })
    }
  }

  // ── Sort all events chronologically ───────────────────────────────────────
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // ── Stats ─────────────────────────────────────────────────────────────────
  const joinedAt = new Date(profile.created_at)
  const daysAsMember = Math.floor(
    (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)
  )

  const stats: JourneyStats = {
    joined_at: profile.created_at,
    total_votes: totalVotes,
    total_arguments: totalArgs,
    clout: profile.clout ?? 0,
    vote_streak: profile.vote_streak ?? 0,
    civic_archetype: profile.civic_archetype ?? null,
    days_as_member: daysAsMember,
  }

  return NextResponse.json({
    authenticated: true,
    events,
    stats,
  } satisfies JourneyResponse)
}
