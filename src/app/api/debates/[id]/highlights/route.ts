import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface HighlightMessage {
  id: string
  content: string
  side: 'blue' | 'red' | null
  is_argument: boolean
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface SwayCheckpoint {
  checkpoint: 1 | 2 | 3
  for_votes: number
  against_votes: number
}

export interface HighlightsResponse {
  debate: {
    id: string
    title: string
    type: string
    status: string
    blue_sway: number
    red_sway: number
    started_at: string | null
    ended_at: string | null
    viewer_count: number
    topic: {
      id: string
      statement: string
      category: string | null
    } | null
    blue_speaker: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
    } | null
    red_speaker: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
    } | null
  }
  top_for: HighlightMessage[]
  top_against: HighlightMessage[]
  top_overall: HighlightMessage[]
  sway: SwayCheckpoint[]
  stats: {
    total_messages: number
    total_arguments: number
    total_upvotes: number
    for_upvotes: number
    against_upvotes: number
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // ── Debate + topic ────────────────────────────────────────────────────────
  const { data: debate } = await supabase
    .from('debates')
    .select(
      'id, title, type, status, blue_sway, red_sway, started_at, ended_at, viewer_count, topic_id'
    )
    .eq('id', id)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  // ── Speakers ──────────────────────────────────────────────────────────────
  const { data: participants } = await supabase
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', id)
    .eq('is_speaker', true)

  let blueSpeaker: HighlightsResponse['debate']['blue_speaker'] = null
  let redSpeaker: HighlightsResponse['debate']['red_speaker'] = null

  if (participants && participants.length > 0) {
    const speakerIds = participants.map((p) => p.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', speakerIds)

    for (const p of participants) {
      const profile = profiles?.find((pr) => pr.id === p.user_id) ?? null
      if (!profile) continue
      const sp = {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      }
      if (p.side === 'blue') blueSpeaker = sp
      else redSpeaker = sp
    }
  }

  // ── All messages ──────────────────────────────────────────────────────────
  const { data: rawMessages } = await supabase
    .from('debate_messages')
    .select('id, content, side, is_argument, upvotes, created_at, user_id')
    .eq('debate_id', id)
    .order('created_at', { ascending: true })

  const messages = rawMessages ?? []

  // Fetch authors
  const authorIds = [...new Set(messages.map((m) => m.user_id))]
  const { data: authors } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', authorIds)
    : { data: [] }

  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]))

  function enrichMessage(m: (typeof messages)[0]): HighlightMessage {
    const a = authorMap.get(m.user_id)
    return {
      id: m.id,
      content: m.content,
      side: m.side as 'blue' | 'red' | null,
      is_argument: m.is_argument,
      upvotes: m.upvotes,
      created_at: m.created_at,
      author: a
        ? {
            id: a.id,
            username: a.username,
            display_name: a.display_name,
            avatar_url: a.avatar_url,
            role: a.role,
          }
        : null,
    }
  }

  // ── Top arguments by side ─────────────────────────────────────────────────
  const forArgs = messages
    .filter((m) => m.is_argument && m.side === 'blue')
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)
    .map(enrichMessage)

  const againstArgs = messages
    .filter((m) => m.is_argument && m.side === 'red')
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)
    .map(enrichMessage)

  // ── Top overall messages (any type, by upvotes) ───────────────────────────
  const topOverall = messages
    .filter((m) => m.upvotes > 0)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 6)
    .map(enrichMessage)

  // ── Sway votes per checkpoint ─────────────────────────────────────────────
  const { data: swayRaw } = await supabase
    .from('debate_sway_votes')
    .select('checkpoint, side')
    .eq('debate_id', id)

  const swayByCheckpoint: Record<number, { for: number; against: number }> = {
    1: { for: 0, against: 0 },
    2: { for: 0, against: 0 },
    3: { for: 0, against: 0 },
  }
  for (const sv of swayRaw ?? []) {
    const cp = sv.checkpoint as 1 | 2 | 3
    if (sv.side === 'blue') swayByCheckpoint[cp].for++
    else swayByCheckpoint[cp].against++
  }

  const sway: SwayCheckpoint[] = [1, 2, 3].map((cp) => ({
    checkpoint: cp as 1 | 2 | 3,
    for_votes: swayByCheckpoint[cp].for,
    against_votes: swayByCheckpoint[cp].against,
  }))

  // ── Aggregate stats ───────────────────────────────────────────────────────
  let totalUpvotes = 0
  let forUpvotes = 0
  let againstUpvotes = 0
  let totalArguments = 0

  for (const m of messages) {
    totalUpvotes += m.upvotes
    if (m.side === 'blue') forUpvotes += m.upvotes
    if (m.side === 'red') againstUpvotes += m.upvotes
    if (m.is_argument) totalArguments++
  }

  return NextResponse.json({
    debate: {
      id: debate.id,
      title: debate.title,
      type: debate.type,
      status: debate.status,
      blue_sway: debate.blue_sway,
      red_sway: debate.red_sway,
      started_at: debate.started_at,
      ended_at: debate.ended_at,
      viewer_count: debate.viewer_count,
      topic: topic ?? null,
      blue_speaker: blueSpeaker,
      red_speaker: redSpeaker,
    },
    top_for: forArgs,
    top_against: againstArgs,
    top_overall: topOverall,
    sway,
    stats: {
      total_messages: messages.length,
      total_arguments: totalArguments,
      total_upvotes: totalUpvotes,
      for_upvotes: forUpvotes,
      against_upvotes: againstUpvotes,
    },
  } satisfies HighlightsResponse)
}
