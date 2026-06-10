import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ParticipantPerf {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  side: 'blue' | 'red'
  is_speaker: boolean
  message_count: number
  argument_count: number
  total_upvotes: number
  avg_upvotes: number
  best_argument: { id: string; content: string; upvotes: number } | null
  sway_pct: number
}

export interface DebatePerformanceResponse {
  debate: {
    id: string
    title: string
    status: string
    blue_sway: number
    red_sway: number
    started_at: string | null
    ended_at: string | null
    topic_statement: string | null
    topic_category: string | null
  }
  blue: ParticipantPerf | null
  red: ParticipantPerf | null
  viewer_count: number
  total_messages: number
  total_arguments: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // Fetch debate
  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, status, blue_sway, red_sway, started_at, ended_at, topic_id, viewer_count')
    .eq('id', id)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  // Topic
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  // Participants (speakers only)
  const { data: participants } = await supabase
    .from('debate_participants')
    .select('user_id, side, is_speaker')
    .eq('debate_id', id)
    .eq('is_speaker', true)

  if (!participants || participants.length === 0) {
    return NextResponse.json({
      debate: {
        id: debate.id,
        title: debate.title,
        status: debate.status,
        blue_sway: debate.blue_sway,
        red_sway: debate.red_sway,
        started_at: debate.started_at,
        ended_at: debate.ended_at,
        topic_statement: topic?.statement ?? null,
        topic_category: topic?.category ?? null,
      },
      blue: null,
      red: null,
      viewer_count: debate.viewer_count,
      total_messages: 0,
      total_arguments: 0,
    } satisfies DebatePerformanceResponse)
  }

  // Profiles
  const userIds = participants.map((p) => p.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)

  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url })
  }

  // All messages in this debate
  const { data: allMessages } = await supabase
    .from('debate_messages')
    .select('id, user_id, content, side, is_argument, upvotes')
    .eq('debate_id', id)

  const messages = allMessages ?? []
  const totalMessages = messages.length
  const totalArguments = messages.filter((m) => m.is_argument).length

  // Build per-participant stats
  function buildPerf(part: typeof participants[0]): ParticipantPerf {
    const prof = profileMap.get(part.user_id)
    const myMessages = messages.filter((m) => m.user_id === part.user_id)
    const myArguments = myMessages.filter((m) => m.is_argument)
    const totalUpvotes = myArguments.reduce((s, m) => s + (m.upvotes ?? 0), 0)
    const avgUpvotes = myArguments.length > 0 ? Math.round((totalUpvotes / myArguments.length) * 10) / 10 : 0
    const bestArg = myArguments.length > 0
      ? myArguments.reduce((best, m) => (m.upvotes ?? 0) > (best.upvotes ?? 0) ? m : best)
      : null

    return {
      user_id: part.user_id,
      username: prof?.username ?? 'unknown',
      display_name: prof?.display_name ?? null,
      avatar_url: prof?.avatar_url ?? null,
      side: part.side as 'blue' | 'red',
      is_speaker: part.is_speaker,
      message_count: myMessages.length,
      argument_count: myArguments.length,
      total_upvotes: totalUpvotes,
      avg_upvotes: avgUpvotes,
      best_argument: bestArg ? { id: bestArg.id, content: bestArg.content, upvotes: bestArg.upvotes } : null,
      sway_pct: part.side === 'blue' ? debate.blue_sway : debate.red_sway,
    }
  }

  const blueParticipant = participants.find((p) => p.side === 'blue')
  const redParticipant = participants.find((p) => p.side === 'red')

  return NextResponse.json({
    debate: {
      id: debate.id,
      title: debate.title,
      status: debate.status,
      blue_sway: debate.blue_sway,
      red_sway: debate.red_sway,
      started_at: debate.started_at,
      ended_at: debate.ended_at,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
    },
    blue: blueParticipant ? buildPerf(blueParticipant) : null,
    red: redParticipant ? buildPerf(redParticipant) : null,
    viewer_count: debate.viewer_count,
    total_messages: totalMessages,
    total_arguments: totalArguments,
  } satisfies DebatePerformanceResponse)
}
