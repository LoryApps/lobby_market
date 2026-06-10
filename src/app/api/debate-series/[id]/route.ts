import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Debate, DebateSeries, DebateParticipantWithProfile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export interface SeriesDebate extends Debate {
  series_round: number | null
  speakers: {
    blue: DebateParticipantWithProfile | null
    red: DebateParticipantWithProfile | null
  }
  winner_side: 'blue' | 'red' | null
}

export interface SeriesDetailResponse {
  series: DebateSeries & {
    topic: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
    creator: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string | null
    } | null
  }
  debates: SeriesDebate[]
  next_debate: SeriesDebate | null
  total_rounds: number
  rounds_needed_to_win: number
}

interface RouteContext {
  params: { id: string }
}

// GET /api/debate-series/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  const { data: series, error: seriesErr } = await supabase
    .from('debate_series')
    .select('*')
    .eq('id', params.id)
    .single()

  if (seriesErr || !series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  const [topicRes, creatorRes, debatesRes] = await Promise.all([
    series.topic_id
      ? supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .eq('id', series.topic_id)
          .single()
      : Promise.resolve({ data: null }),
    series.creator_id
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .eq('id', series.creator_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('debates')
      .select('*')
      .eq('series_id', params.id)
      .order('series_round', { ascending: true }),
  ])

  const debateRows = (debatesRes.data ?? []) as (Debate & { series_round: number | null })[]

  // Fetch speakers (is_speaker=true) for each debate in bulk
  const debateIds = debateRows.map((d) => d.id)
  const speakerRes = debateIds.length
    ? await supabase
        .from('debate_participants')
        .select('debate_id, user_id, side, is_speaker, joined_at')
        .in('debate_id', debateIds)
        .eq('is_speaker', true)
    : { data: [] }

  const speakerUserIds = [
    ...new Set((speakerRes.data ?? []).map((p: { user_id: string }) => p.user_id)),
  ] as string[]

  const profilesRes = speakerUserIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', speakerUserIds)
    : { data: [] }

  type RawSpeaker = { debate_id: string; user_id: string; side: 'blue' | 'red'; is_speaker: boolean; joined_at: string }
  type RawProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string | null }

  const profileMap = new Map<string, RawProfile>(
    (profilesRes.data ?? []).map((p: RawProfile) => [p.id, p])
  )

  // Group speakers by debate
  const speakersByDebate = new Map<string, { blue: DebateParticipantWithProfile | null; red: DebateParticipantWithProfile | null }>()
  for (const sp of speakerRes.data ?? [] as RawSpeaker[]) {
    const s = sp as RawSpeaker
    const profile = profileMap.get(s.user_id) ?? null
    const existing = speakersByDebate.get(s.debate_id) ?? { blue: null, red: null }
    const enriched = profile ? { ...s, profile } as unknown as DebateParticipantWithProfile : null
    if (enriched) {
      if (s.side === 'blue') existing.blue = enriched
      else existing.red = enriched
    }
    speakersByDebate.set(s.debate_id, existing)
  }

  // Determine winner for each ended debate
  const enrichedDebates: SeriesDebate[] = debateRows.map((d) => {
    const speakers = speakersByDebate.get(d.id) ?? { blue: null, red: null }
    let winner: 'blue' | 'red' | null = null
    if (d.status === 'ended') {
      if (d.blue_sway > d.red_sway) winner = 'blue'
      else if (d.red_sway > d.blue_sway) winner = 'red'
    }
    return { ...d, speakers, winner_side: winner }
  })

  // Next debate = first scheduled or live
  const nextDebate = enrichedDebates.find((d) => d.status === 'scheduled' || d.status === 'live') ?? null

  // Rounds needed to win depends on format
  const formatMap: Record<string, number> = {
    best_of_3: 2,
    best_of_5: 3,
    best_of_7: 4,
    fixed: 0,
  }
  const s = series as DebateSeries
  const roundsNeeded = formatMap[s.format] ?? 2

  return NextResponse.json({
    series: {
      ...s,
      topic: topicRes.data ?? null,
      creator: creatorRes.data ?? null,
    },
    debates: enrichedDebates,
    next_debate: nextDebate,
    total_rounds: debateRows.length,
    rounds_needed_to_win: roundsNeeded,
  } satisfies SeriesDetailResponse)
}

// PATCH /api/debate-series/[id] — update wins, status, winner
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('debate_series')
    .update(body)
    .eq('id', params.id)
    .eq('creator_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ series: data })
}
