import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClashArgument {
  id: string
  content: string
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface ClashSpeaker {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  argument_count: number
  total_upvotes: number
  best_argument: ClashArgument | null
}

export interface ClashResponse {
  debate: {
    id: string
    title: string
    type: string
    status: string
    started_at: string | null
    ended_at: string | null
    viewer_count: number
    blue_sway: number
    red_sway: number
    topic: {
      id: string
      statement: string
      category: string | null
      blue_pct: number
      total_votes: number
    } | null
  }
  for_side: ClashSpeaker | null
  against_side: ClashSpeaker | null
  winner: 'for' | 'against' | 'tie' | null
  poll: {
    for_pct: number
    against_pct: number
    tie_pct: number
    total: number
  }
  stats: {
    total_messages: number
    total_arguments: number
    for_argument_count: number
    against_argument_count: number
    for_upvotes: number
    against_upvotes: number
  }
  top_for: ClashArgument | null
  top_against: ClashArgument | null
}

// ─── GET /api/debates/[id]/clash ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // ── Debate ────────────────────────────────────────────────────────────────
  const { data: debate } = await supabase
    .from('debates')
    .select(
      'id, title, type, status, started_at, ended_at, viewer_count, blue_sway, red_sway, topic_id'
    )
    .eq('id', id)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  // ── Topic ─────────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes')
    .eq('id', debate.topic_id)
    .maybeSingle()

  // ── Speakers ──────────────────────────────────────────────────────────────
  const { data: participants } = await supabase
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', id)
    .eq('is_speaker', true)

  let blueUserId: string | null = null
  let redUserId: string | null = null

  for (const p of participants ?? []) {
    if (p.side === 'blue') blueUserId = p.user_id
    else redUserId = p.user_id
  }

  const speakerIds = [blueUserId, redUserId].filter(Boolean) as string[]
  const { data: speakerProfiles } = speakerIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', speakerIds)
    : { data: [] as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }> }

  const profileMap = new Map((speakerProfiles ?? []).map((p) => [p.id, p]))

  // ── Messages ──────────────────────────────────────────────────────────────
  const { data: rawMessages } = await supabase
    .from('debate_messages')
    .select('id, content, side, is_argument, upvotes, created_at, user_id')
    .eq('debate_id', id)
    .order('upvotes', { ascending: false })

  const messages = rawMessages ?? []

  // Author profiles for message enrichment
  const authorIds = [...new Set(messages.map((m) => m.user_id))]
  const { data: authors } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds)
    : { data: [] as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }> }

  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]))

  function enrichArg(m: (typeof messages)[0]): ClashArgument {
    const a = authorMap.get(m.user_id)
    return {
      id: m.id,
      content: m.content,
      upvotes: m.upvotes,
      created_at: m.created_at,
      author: a ? { id: a.id, username: a.username, display_name: a.display_name, avatar_url: a.avatar_url } : null,
    }
  }

  // ── Best arguments per side ───────────────────────────────────────────────
  const forMessages = messages.filter((m) => m.is_argument && m.side === 'blue')
  const againstMessages = messages.filter((m) => m.is_argument && m.side === 'red')

  const topFor = forMessages[0] ? enrichArg(forMessages[0]) : null
  const topAgainst = againstMessages[0] ? enrichArg(againstMessages[0]) : null

  // ── Per-speaker stats ─────────────────────────────────────────────────────
  function buildSpeaker(userId: string | null, _side: 'blue' | 'red'): ClashSpeaker | null {
    if (!userId) return null
    const profile = profileMap.get(userId)
    if (!profile) return null

    const speakerMessages = messages.filter((m) => m.user_id === userId)
    const speakerArgs = speakerMessages.filter((m) => m.is_argument)
    const totalUp = speakerMessages.reduce((sum, m) => sum + (m.upvotes ?? 0), 0)
    const bestMsg = speakerArgs.sort((a, b) => b.upvotes - a.upvotes)[0]

    return {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      argument_count: speakerArgs.length,
      total_upvotes: totalUp,
      best_argument: bestMsg ? enrichArg(bestMsg) : null,
    }
  }

  const forSide = buildSpeaker(blueUserId, 'blue')
  const againstSide = buildSpeaker(redUserId, 'red')

  // ── Community winner poll ─────────────────────────────────────────────────
  const { data: pollRows } = await supabase
    .from('debate_winner_polls')
    .select('winner')
    .eq('debate_id', id)

  const pollCounts = { blue: 0, red: 0, tie: 0 }
  for (const r of pollRows ?? []) {
    const w = r.winner as 'blue' | 'red' | 'tie'
    pollCounts[w] = (pollCounts[w] ?? 0) + 1
  }
  const pollTotal = pollCounts.blue + pollCounts.red + pollCounts.tie

  let winner: 'for' | 'against' | 'tie' | null = null
  if (pollTotal > 0) {
    if (pollCounts.blue > pollCounts.red && pollCounts.blue > pollCounts.tie) winner = 'for'
    else if (pollCounts.red > pollCounts.blue && pollCounts.red > pollCounts.tie) winner = 'against'
    else winner = 'tie'
  } else {
    // Fall back to sway winner
    const blueSway = debate.blue_sway ?? 0
    const redSway = debate.red_sway ?? 0
    if (blueSway > redSway) winner = 'for'
    else if (redSway > blueSway) winner = 'against'
    else if (debate.status === 'ended') winner = 'tie'
  }

  // ── Aggregate stats ───────────────────────────────────────────────────────
  let forUpvotes = 0
  let againstUpvotes = 0

  for (const m of messages) {
    if (m.side === 'blue') forUpvotes += m.upvotes ?? 0
    else if (m.side === 'red') againstUpvotes += m.upvotes ?? 0
  }

  const response: ClashResponse = {
    debate: {
      id: debate.id,
      title: debate.title,
      type: debate.type,
      status: debate.status,
      started_at: debate.started_at,
      ended_at: debate.ended_at,
      viewer_count: debate.viewer_count,
      blue_sway: debate.blue_sway ?? 0,
      red_sway: debate.red_sway ?? 0,
      topic: topic
        ? {
            id: topic.id,
            statement: topic.statement,
            category: topic.category,
            blue_pct: topic.blue_pct ?? 50,
            total_votes: topic.total_votes ?? 0,
          }
        : null,
    },
    for_side: forSide,
    against_side: againstSide,
    winner,
    poll: {
      for_pct: pollTotal > 0 ? Math.round((pollCounts.blue / pollTotal) * 100) : 0,
      against_pct: pollTotal > 0 ? Math.round((pollCounts.red / pollTotal) * 100) : 0,
      tie_pct: pollTotal > 0 ? Math.round((pollCounts.tie / pollTotal) * 100) : 0,
      total: pollTotal,
    },
    stats: {
      total_messages: messages.length,
      total_arguments: forMessages.length + againstMessages.length,
      for_argument_count: forMessages.length,
      against_argument_count: againstMessages.length,
      for_upvotes: forUpvotes,
      against_upvotes: againstUpvotes,
    },
    top_for: topFor,
    top_against: topAgainst,
  }

  return NextResponse.json(response)
}
