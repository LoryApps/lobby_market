import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateStat {
  debate_id: string
  title: string
  topic_statement: string | null
  topic_id: string | null
  type: 'quick' | 'grand' | 'tribunal'
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_at: string
  ended_at: string | null
  side: 'blue' | 'red'
  is_speaker: boolean
  blue_sway: number
  red_sway: number
  // Sway votes the user cast in this debate
  sway_votes_cast: number
  // Winner poll vote the user cast (if any)
  poll_vote: 'blue' | 'red' | 'tie' | null
  // Actual winner derived from blue_sway vs red_sway
  winner: 'blue' | 'red' | 'tie' | null
  // Did the user's poll pick match the sway winner?
  poll_correct: boolean | null
  viewer_count: number
}

export type DebateArchetype =
  | 'newcomer'     // < 3 debates
  | 'observer'     // participated mostly as viewer, not speaker
  | 'orator'       // mostly as speaker, high speaker rate
  | 'strategist'   // high sway voting activity
  | 'prognosticator' // high poll accuracy

export interface DebateAnalyticsResponse {
  total_participated: number
  as_speaker: number
  as_viewer: number
  blue_side: number
  red_side: number
  total_sway_votes: number
  total_poll_votes: number
  poll_accuracy: number | null   // % of winner polls correctly predicted; null if < 3
  week_participated: number
  recent_debates: DebateStat[]
  type_breakdown: Array<{ type: string; count: number }>
  archetype: DebateArchetype
  // Most common topic categories debated
  category_breakdown: Array<{ category: string; count: number }>
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch all debates the user participated in
  const { data: participations, error: partError } = await supabase
    .from('debate_participants')
    .select('debate_id, side, is_speaker, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (partError) {
    return NextResponse.json({ error: partError.message }, { status: 500 })
  }

  const parts = participations ?? []

  if (parts.length === 0) {
    return NextResponse.json({
      total_participated: 0,
      as_speaker: 0,
      as_viewer: 0,
      blue_side: 0,
      red_side: 0,
      total_sway_votes: 0,
      total_poll_votes: 0,
      poll_accuracy: null,
      week_participated: 0,
      recent_debates: [],
      type_breakdown: [],
      archetype: 'newcomer',
      category_breakdown: [],
    } satisfies DebateAnalyticsResponse)
  }

  const debateIds = [...new Set(parts.map((p) => p.debate_id))]

  // 2. Fetch debate metadata
  const { data: debates } = await supabase
    .from('debates')
    .select('id, title, topic_id, type, status, scheduled_at, ended_at, blue_sway, red_sway, viewer_count')
    .in('id', debateIds)

  type DebateRow = {
    id: string
    title: string
    topic_id: string | null
    type: string
    status: string
    scheduled_at: string
    ended_at: string | null
    blue_sway: number
    red_sway: number
    viewer_count: number
  }

  const debateById: Record<string, DebateRow> = {}
  for (const d of (debates ?? []) as DebateRow[]) {
    debateById[d.id] = d
  }

  // 3. Fetch topics for statements + categories
  const topicIds = [...new Set(
    Object.values(debateById)
      .map((d) => d.topic_id)
      .filter(Boolean) as string[]
  )]

  type TopicRow = { id: string; statement: string; category: string | null }
  const topicById: Record<string, TopicRow> = {}

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds)
    for (const t of (topics ?? []) as TopicRow[]) {
      topicById[t.id] = t
    }
  }

  // 4. Fetch user's sway votes
  const { data: swayVotes } = await supabase
    .from('debate_sway_votes')
    .select('debate_id')
    .eq('user_id', user.id)
    .in('debate_id', debateIds)

  const swayByDebate: Record<string, number> = {}
  for (const sv of swayVotes ?? []) {
    swayByDebate[sv.debate_id] = (swayByDebate[sv.debate_id] ?? 0) + 1
  }

  // 5. Fetch user's winner poll votes
  const { data: pollVotes } = await supabase
    .from('debate_winner_polls')
    .select('debate_id, winner')
    .eq('user_id', user.id)
    .in('debate_id', debateIds)

  type PollRow = { debate_id: string; winner: 'blue' | 'red' | 'tie' }
  const pollByDebate: Record<string, 'blue' | 'red' | 'tie'> = {}
  for (const pv of (pollVotes ?? []) as PollRow[]) {
    pollByDebate[pv.debate_id] = pv.winner
  }

  // 6. Build per-debate stats
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  let totalSpeaker = 0
  let totalViewer = 0
  let blueSide = 0
  let redSide = 0
  let totalSway = 0
  let totalPoll = 0
  let pollCorrect = 0
  let pollResolved = 0
  let weekCount = 0

  const recentDebates: DebateStat[] = []

  const typeCounts: Record<string, number> = {}
  const catCounts: Record<string, number> = {}

  for (const part of parts) {
    const debate = debateById[part.debate_id]
    if (!debate) continue

    if (part.is_speaker) totalSpeaker++
    else totalViewer++

    if (part.side === 'blue') blueSide++
    else redSide++

    if (new Date(part.joined_at) >= weekAgo) weekCount++

    const swayCount = swayByDebate[debate.id] ?? 0
    totalSway += swayCount

    const pollVote = pollByDebate[debate.id] ?? null
    if (pollVote) totalPoll++

    // Derive winner from sway
    let winner: 'blue' | 'red' | 'tie' | null = null
    if (debate.status === 'ended') {
      if (debate.blue_sway > debate.red_sway) winner = 'blue'
      else if (debate.red_sway > debate.blue_sway) winner = 'red'
      else winner = 'tie'
    }

    let pollCorrectFlag: boolean | null = null
    if (pollVote && winner !== null) {
      pollResolved++
      if (pollVote === winner) {
        pollCorrect++
        pollCorrectFlag = true
      } else {
        pollCorrectFlag = false
      }
    }

    typeCounts[debate.type] = (typeCounts[debate.type] ?? 0) + 1

    const topic = debate.topic_id ? topicById[debate.topic_id] : null
    const cat = topic?.category ?? 'Unknown'
    catCounts[cat] = (catCounts[cat] ?? 0) + 1

    if (recentDebates.length < 20) {
      recentDebates.push({
        debate_id: debate.id,
        title: debate.title,
        topic_statement: topic?.statement ?? null,
        topic_id: debate.topic_id,
        type: debate.type as 'quick' | 'grand' | 'tribunal',
        status: debate.status as 'scheduled' | 'live' | 'ended' | 'cancelled',
        scheduled_at: debate.scheduled_at,
        ended_at: debate.ended_at,
        side: part.side as 'blue' | 'red',
        is_speaker: part.is_speaker,
        blue_sway: debate.blue_sway,
        red_sway: debate.red_sway,
        sway_votes_cast: swayCount,
        poll_vote: pollVote,
        winner,
        poll_correct: pollCorrectFlag,
        viewer_count: debate.viewer_count,
      })
    }
  }

  const pollAccuracy =
    pollResolved >= 3
      ? Math.round((pollCorrect / pollResolved) * 100)
      : null

  const typeBreakdown = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type, count }))

  const categoryBreakdown = Object.entries(catCounts)
    .filter(([cat]) => cat !== 'Unknown')
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([category, count]) => ({ category, count }))

  // 7. Archetype
  const total = parts.length
  const speakerRate = total > 0 ? totalSpeaker / total : 0
  const swayRate = total > 0 ? totalSway / total : 0

  let archetype: DebateArchetype
  if (total < 3) {
    archetype = 'newcomer'
  } else if (pollAccuracy !== null && pollAccuracy >= 65) {
    archetype = 'prognosticator'
  } else if (speakerRate >= 0.5) {
    archetype = 'orator'
  } else if (swayRate >= 2) {
    archetype = 'strategist'
  } else {
    archetype = 'observer'
  }

  return NextResponse.json({
    total_participated: total,
    as_speaker: totalSpeaker,
    as_viewer: totalViewer,
    blue_side: blueSide,
    red_side: redSide,
    total_sway_votes: totalSway,
    total_poll_votes: totalPoll,
    poll_accuracy: pollAccuracy,
    week_participated: weekCount,
    recent_debates: recentDebates,
    type_breakdown: typeBreakdown,
    archetype,
    category_breakdown: categoryBreakdown,
  } satisfies DebateAnalyticsResponse)
}
