import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface AudienceSway {
  checkpoint: 1 | 2 | 3
  label: string
  for_votes: number
  against_votes: number
  for_pct: number
}

export interface AudienceResponse {
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
    blue_speaker: {
      username: string
      display_name: string | null
      avatar_url: string | null
    } | null
    red_speaker: {
      username: string
      display_name: string | null
      avatar_url: string | null
    } | null
  }
  rsvp_count: number
  poll: {
    blue: number
    red: number
    tie: number
    total: number
    user_vote: 'blue' | 'red' | 'tie' | null
  }
  sway: AudienceSway[]
}

const CHECKPOINT_LABELS: Record<number, string> = {
  1: 'Opening',
  2: 'Midpoint',
  3: 'Closing',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  const { data: { user } } = await supabase.auth.getUser()

  // ── Debate ─────────────────────────────────────────────────────────────────
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

  // ── Topic ──────────────────────────────────────────────────────────────────
  const topicPromise = debate.topic_id
    ? supabase
        .from('topics')
        .select('id, statement, category, blue_pct, total_votes')
        .eq('id', debate.topic_id)
        .maybeSingle()
    : Promise.resolve({ data: null })

  // ── Speakers ───────────────────────────────────────────────────────────────
  const speakersPromise = supabase
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', id)
    .eq('is_speaker', true)

  // ── RSVPs ──────────────────────────────────────────────────────────────────
  const rsvpPromise = supabase
    .from('debate_rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('debate_id', id)

  // ── Winner poll ────────────────────────────────────────────────────────────
  const pollPromise = supabase
    .from('debate_winner_polls')
    .select('winner, user_id')
    .eq('debate_id', id)

  // ── Sway votes ─────────────────────────────────────────────────────────────
  const swayPromise = supabase
    .from('debate_sway_votes')
    .select('checkpoint, side')
    .eq('debate_id', id)

  const [topicRes, speakersRes, rsvpRes, pollRes, swayRes] = await Promise.all([
    topicPromise,
    speakersPromise,
    rsvpPromise,
    pollPromise,
    swayPromise,
  ])

  const topic = topicRes.data ?? null
  const speakers = speakersRes.data ?? []
  const rsvpCount = rsvpRes.count ?? 0

  // ── Build speakers ─────────────────────────────────────────────────────────
  let blueSpeaker: AudienceResponse['debate']['blue_speaker'] = null
  let redSpeaker: AudienceResponse['debate']['red_speaker'] = null

  if (speakers.length > 0) {
    const speakerIds = speakers.map((s) => s.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', speakerIds)

    for (const s of speakers) {
      const p = profiles?.find((pr) => pr.id === s.user_id)
      if (!p) continue
      const sp = {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      }
      if (s.side === 'blue') blueSpeaker = sp
      else redSpeaker = sp
    }
  }

  // ── Build winner poll ──────────────────────────────────────────────────────
  const pollRows = pollRes.data ?? []
  const pollCounts = { blue: 0, red: 0, tie: 0 }
  let userVote: 'blue' | 'red' | 'tie' | null = null

  for (const row of pollRows) {
    const w = row.winner as 'blue' | 'red' | 'tie'
    pollCounts[w] = (pollCounts[w] ?? 0) + 1
    if (user && row.user_id === user.id) userVote = w
  }

  // ── Build sway per checkpoint ──────────────────────────────────────────────
  const swayRows = swayRes.data ?? []
  const swayByCheckpoint: Record<number, { for: number; against: number }> = {
    1: { for: 0, against: 0 },
    2: { for: 0, against: 0 },
    3: { for: 0, against: 0 },
  }
  for (const sv of swayRows) {
    const cp = sv.checkpoint as 1 | 2 | 3
    if (sv.side === 'blue') swayByCheckpoint[cp].for++
    else swayByCheckpoint[cp].against++
  }

  const sway: AudienceSway[] = [1, 2, 3].map((cp) => {
    const d = swayByCheckpoint[cp]
    const total = d.for + d.against
    return {
      checkpoint: cp as 1 | 2 | 3,
      label: CHECKPOINT_LABELS[cp],
      for_votes: d.for,
      against_votes: d.against,
      for_pct: total > 0 ? Math.round((d.for / total) * 100) : 50,
    }
  })

  const response: AudienceResponse = {
    debate: {
      id: debate.id,
      title: debate.title,
      type: debate.type,
      status: debate.status,
      started_at: debate.started_at,
      ended_at: debate.ended_at,
      viewer_count: debate.viewer_count ?? 0,
      blue_sway: debate.blue_sway ?? 0,
      red_sway: debate.red_sway ?? 0,
      topic: topic
        ? {
            id: topic.id,
            statement: topic.statement,
            category: topic.category,
            blue_pct: Math.round(topic.blue_pct ?? 50),
            total_votes: topic.total_votes ?? 0,
          }
        : null,
      blue_speaker: blueSpeaker,
      red_speaker: redSpeaker,
    },
    rsvp_count: rsvpCount,
    poll: {
      ...pollCounts,
      total: pollRows.length,
      user_vote: userVote,
    },
    sway,
  }

  return NextResponse.json(response)
}
