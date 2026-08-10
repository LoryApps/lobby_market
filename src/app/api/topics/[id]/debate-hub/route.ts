import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DebateHubEntry {
  id: string
  title: string
  type: string
  status: string
  scheduled_at: string | null
  viewer_count: number
  blue_sway: number
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
    side: string | null
    is_speaker: boolean
  }>
}

export interface DebateHubResponse {
  topic_statement: string
  debates: DebateHubEntry[]
  counts: {
    total: number
    live: number
    scheduled: number
    ended: number
  }
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

  const [topicRes, debatesRes] = await Promise.all([
    supabase
      .from('topics')
      .select('statement')
      .eq('id', topicId)
      .single(),
    supabase
      .from('debates')
      .select('*')
      .eq('topic_id', topicId)
      .not('status', 'eq', 'cancelled')
      .order('scheduled_at', { ascending: true })
      .limit(100),
  ])

  if (topicRes.error || !topicRes.data) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const debatesRaw = debatesRes.data ?? []

  // Sort: live first, then scheduled (soonest first), then ended (most recent first)
  const STATUS_ORDER: Record<string, number> = { live: 0, scheduled: 1, ended: 2 }
  const sorted = [...debatesRaw].sort((a, b) => {
    const orderDiff =
      (STATUS_ORDER[a.status as string] ?? 9) -
      (STATUS_ORDER[b.status as string] ?? 9)
    if (orderDiff !== 0) return orderDiff
    // Within scheduled: soonest first; within ended: most recent first
    const aTime = a.scheduled_at ? new Date(a.scheduled_at as string).getTime() : 0
    const bTime = b.scheduled_at ? new Date(b.scheduled_at as string).getTime() : 0
    return a.status === 'ended' ? bTime - aTime : aTime - bTime
  })

  if (sorted.length === 0) {
    return NextResponse.json({
      topic_statement: topicRes.data.statement,
      debates: [],
      counts: { total: 0, live: 0, scheduled: 0, ended: 0 },
    } satisfies DebateHubResponse)
  }

  const creatorIds = Array.from(new Set(sorted.map((d) => d.creator_id as string)))
  const debateIds = sorted.map((d) => d.id as string)

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

  const participantUserIds = Array.from(
    new Set(participantRows.map((p) => p.user_id as string))
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

  const enriched: DebateHubEntry[] = sorted.map((d) => {
    const creator = creatorById[d.creator_id as string]
    const myParticipants = participantRows
      .filter((p) => p.debate_id === d.id)
      .map((p) => {
        const prof = profileById[p.user_id as string]
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

  const counts = {
    total: enriched.length,
    live: enriched.filter((d) => d.status === 'live').length,
    scheduled: enriched.filter((d) => d.status === 'scheduled').length,
    ended: enriched.filter((d) => d.status === 'ended').length,
  }

  return NextResponse.json({
    topic_statement: topicRes.data.statement,
    debates: enriched,
    counts,
  } satisfies DebateHubResponse)
}
