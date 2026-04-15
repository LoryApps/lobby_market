import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface TopicDebate {
  id: string
  title: string
  type: string
  status: string
  scheduled_at: string | null
  viewer_count: number
  /** Audience sway: percentage favouring FOR (0–100) */
  blue_sway: number
  /** Audience sway: percentage favouring AGAINST (0–100) */
  red_sway: number
  creator_id: string
  creator_username: string | null
  creator_display_name: string | null
  creator_avatar_url: string | null
  participants: Array<{
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    /** 'for' | 'against' */
    side: string | null
    is_speaker: boolean
  }>
}

export interface TopicDebatesResponse {
  debates: TopicDebate[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch debates linked to this topic — live and scheduled first,
  // then recently ended. Cap at 5 total.
  const { data: debatesRaw, error } = await supabase
    .from('debates')
    .select('*')
    .eq('topic_id', topicId)
    .not('status', 'eq', 'cancelled')
    .order('scheduled_at', { ascending: true })
    .limit(5)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load debates' },
      { status: 500 }
    )
  }

  if (!debatesRaw || debatesRaw.length === 0) {
    return NextResponse.json({ debates: [] } satisfies TopicDebatesResponse)
  }

  // Sort: live first, then scheduled, then ended
  const ORDER: Record<string, number> = { live: 0, scheduled: 1, ended: 2 }
  const debates = [...debatesRaw].sort(
    (a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
  )

  const creatorIds = Array.from(new Set(debates.map((d) => d.creator_id)))
  const debateIds = debates.map((d) => d.id)

  const [creatorsRes, participantsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', creatorIds),
    supabase
      .from('debate_participants')
      .select('debate_id, user_id, side, is_speaker')
      .in('debate_id', debateIds),
  ])

  const creators = creatorsRes.data ?? []
  const participantRows = participantsRes.data ?? []

  // Fetch participant profiles
  const participantUserIds = Array.from(
    new Set(participantRows.map((p) => p.user_id))
  )
  let participantProfiles: Array<{
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  }> = []
  if (participantUserIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', participantUserIds)
    participantProfiles = data ?? []
  }

  const profileById = Object.fromEntries(
    participantProfiles.map((p) => [p.id, p])
  )
  const creatorById = Object.fromEntries(creators.map((c) => [c.id, c]))

  const enriched: TopicDebate[] = debates.map((d) => {
    const creator = creatorById[d.creator_id]
    const myParticipants = participantRows
      .filter((p) => p.debate_id === d.id)
      .map((p) => {
        const prof = profileById[p.user_id]
        return {
          id: p.user_id as string,
          username: prof?.username ?? null,
          display_name: prof?.display_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
          side: (p.side as string | null) ?? null,
          is_speaker: (p.is_speaker as boolean) ?? false,
        }
      })

    return {
      id: d.id as string,
      title: (d.title as string | null) ?? 'Untitled Debate',
      type: (d.type as string | null) ?? 'oxford',
      status: d.status as string,
      scheduled_at: (d.scheduled_at as string | null) ?? null,
      viewer_count: (d.viewer_count as number | null) ?? 0,
      blue_sway: (d.blue_sway as number | null) ?? 50,
      red_sway: (d.red_sway as number | null) ?? 50,
      creator_id: d.creator_id as string,
      creator_username: creator?.username ?? null,
      creator_display_name: creator?.display_name ?? null,
      creator_avatar_url: creator?.avatar_url ?? null,
      participants: myParticipants,
    }
  })

  return NextResponse.json({ debates: enriched } satisfies TopicDebatesResponse)
}
