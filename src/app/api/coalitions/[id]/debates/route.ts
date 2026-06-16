import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ────────────────────────────────────────────────────────────

export interface CoalitionDebateMember {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  side: 'blue' | 'red'
  isSpeaker: boolean
}

export interface CoalitionDebateEntry {
  id: string
  title: string
  type: string
  status: string
  scheduledAt: string | null
  endedAt: string | null
  viewerCount: number
  blueSway: number
  redSway: number
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    bluePct: number
  } | null
  coalitionParticipants: CoalitionDebateMember[]
}

export interface CoalitionDebatesStats {
  total: number
  upcoming: number
  live: number
  ended: number
  wins: number
  losses: number
  uniqueSpeakers: number
}

export interface CoalitionDebatesResponse {
  coalition: {
    id: string
    name: string
    memberCount: number
    avatarUrl: string | null
  }
  stats: CoalitionDebatesStats
  debates: CoalitionDebateEntry[]
  isMember: boolean
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status') // 'upcoming' | 'live' | 'ended' | null

  // ── Coalition info ──────────────────────────────────────────────────────────
  const { data: coalition, error: coalErr } = await supabase
    .from('coalitions')
    .select('id, name, member_count, avatar_url, is_public')
    .eq('id', coalitionId)
    .maybeSingle()

  if (coalErr || !coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // ── Auth check ──────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  let isMember = false
  if (userId) {
    const { data: membership } = await supabase
      .from('coalition_members')
      .select('id')
      .eq('coalition_id', coalitionId)
      .eq('user_id', userId)
      .maybeSingle()
    isMember = !!membership
  }

  // Private coalitions: only members can see
  if (!coalition.is_public && !isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Get coalition member IDs ─────────────────────────────────────────────
  const { data: memberRows } = await supabase
    .from('coalition_members')
    .select('user_id')
    .eq('coalition_id', coalitionId)
    .limit(500)

  const memberUserIds = (memberRows ?? []).map((m) => m.user_id)

  if (memberUserIds.length === 0) {
    return NextResponse.json({
      coalition: {
        id: coalition.id,
        name: coalition.name,
        memberCount: coalition.member_count ?? 0,
        avatarUrl: coalition.avatar_url ?? null,
      },
      stats: { total: 0, upcoming: 0, live: 0, ended: 0, wins: 0, losses: 0, uniqueSpeakers: 0 },
      debates: [],
      isMember,
    } satisfies CoalitionDebatesResponse)
  }

  // ── Debates where coalition members participated ─────────────────────────
  const { data: participationRows } = await supabase
    .from('debate_participants')
    .select('debate_id, user_id, side, is_speaker')
    .in('user_id', memberUserIds)
    .limit(1000)

  const debateIds = Array.from(
    new Set((participationRows ?? []).map((p) => p.debate_id)),
  )

  if (debateIds.length === 0) {
    return NextResponse.json({
      coalition: {
        id: coalition.id,
        name: coalition.name,
        memberCount: coalition.member_count ?? 0,
        avatarUrl: coalition.avatar_url ?? null,
      },
      stats: { total: 0, upcoming: 0, live: 0, ended: 0, wins: 0, losses: 0, uniqueSpeakers: 0 },
      debates: [],
      isMember,
    } satisfies CoalitionDebatesResponse)
  }

  // ── Fetch debates ───────────────────────────────────────────────────────────
  let debateQuery = supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, ended_at, viewer_count, blue_sway, red_sway, topic_id')
    .in('id', debateIds)
    .not('status', 'eq', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .limit(100)

  if (statusFilter === 'upcoming') {
    debateQuery = debateQuery.eq('status', 'scheduled')
  } else if (statusFilter === 'live') {
    debateQuery = debateQuery.eq('status', 'live')
  } else if (statusFilter === 'ended') {
    debateQuery = debateQuery.eq('status', 'ended')
  }

  const { data: debates } = await debateQuery

  if (!debates || debates.length === 0) {
    return NextResponse.json({
      coalition: {
        id: coalition.id,
        name: coalition.name,
        memberCount: coalition.member_count ?? 0,
        avatarUrl: coalition.avatar_url ?? null,
      },
      stats: { total: 0, upcoming: 0, live: 0, ended: 0, wins: 0, losses: 0, uniqueSpeakers: 0 },
      debates: [],
      isMember,
    } satisfies CoalitionDebatesResponse)
  }

  // ── Fetch topics ────────────────────────────────────────────────────────────
  const topicIds = Array.from(new Set(debates.map((d) => d.topic_id).filter(Boolean)))
  const { data: topics } = topicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct')
        .in('id', topicIds)
    : { data: [] }

  const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

  // ── Fetch member profiles ────────────────────────────────────────────────
  const { data: memberProfiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', memberUserIds)

  const profileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]))

  // ── Build participation index per debate ────────────────────────────────
  const participationByDebate = new Map<string, typeof participationRows>()
  for (const p of participationRows ?? []) {
    const list = participationByDebate.get(p.debate_id) ?? []
    list.push(p)
    participationByDebate.set(p.debate_id, list)
  }

  // ── Compute stats ───────────────────────────────────────────────────────
  const returnedDebateIds = new Set(debates.map((d) => d.id))
  const allDebates = debates

  let upcoming = 0
  let live = 0
  let ended = 0
  let wins = 0
  let losses = 0
  const speakerSet = new Set<string>()

  for (const d of allDebates) {
    if (!returnedDebateIds.has(d.id)) continue
    if (d.status === 'scheduled') upcoming++
    if (d.status === 'live') live++
    if (d.status === 'ended') {
      ended++
      // Determine outcome from the topic resolution
      const topic = topicMap.get(d.topic_id)
      const parts = participationByDebate.get(d.id) ?? []

      // Check if any coalition speaker was on the winning side
      for (const p of parts) {
        if (!memberUserIds.includes(p.user_id)) continue
        if (p.is_speaker) speakerSet.add(p.user_id)
        if (topic) {
          const side = p.side
          if (topic.status === 'law' && side === 'blue') wins++
          else if (topic.status === 'failed' && side === 'red') wins++
          else if (topic.status === 'law' && side === 'red') losses++
          else if (topic.status === 'failed' && side === 'blue') losses++
          else if (d.status === 'ended') {
            // Sway-based outcome
            const blueSway = d.blue_sway ?? 0
            const redSway = d.red_sway ?? 0
            if (side === 'blue' && blueSway > redSway) wins++
            else if (side === 'red' && redSway > blueSway) wins++
            else if (side === 'blue' && blueSway < redSway) losses++
            else if (side === 'red' && redSway < blueSway) losses++
          }
        }
      }
    }
  }

  // ── Assemble response ───────────────────────────────────────────────────
  const entries: CoalitionDebateEntry[] = allDebates.map((d) => {
    const topic = topicMap.get(d.topic_id) ?? null
    const parts = participationByDebate.get(d.id) ?? []

    const coalitionParticipants: CoalitionDebateMember[] = parts
      .filter((p) => memberUserIds.includes(p.user_id))
      .map((p) => {
        const prof = profileMap.get(p.user_id)
        return {
          userId: p.user_id,
          username: prof?.username ?? 'unknown',
          displayName: prof?.display_name ?? null,
          avatarUrl: prof?.avatar_url ?? null,
          side: (p.side as 'blue' | 'red') ?? 'blue',
          isSpeaker: (p.is_speaker as boolean) ?? false,
        }
      })
      .sort((a, b) => (b.isSpeaker ? 1 : 0) - (a.isSpeaker ? 1 : 0))

    return {
      id: d.id,
      title: d.title ?? 'Untitled Debate',
      type: d.type ?? 'quick',
      status: d.status,
      scheduledAt: d.scheduled_at ?? null,
      endedAt: d.ended_at ?? null,
      viewerCount: d.viewer_count ?? 0,
      blueSway: d.blue_sway ?? 50,
      redSway: d.red_sway ?? 50,
      topic: topic
        ? {
            id: topic.id,
            statement: topic.statement,
            category: topic.category ?? null,
            status: topic.status,
            bluePct: topic.blue_pct ?? 50,
          }
        : null,
      coalitionParticipants,
    }
  })

  return NextResponse.json({
    coalition: {
      id: coalition.id,
      name: coalition.name,
      memberCount: coalition.member_count ?? 0,
      avatarUrl: coalition.avatar_url ?? null,
    },
    stats: {
      total: allDebates.length,
      upcoming,
      live,
      ended,
      wins,
      losses,
      uniqueSpeakers: speakerSet.size,
    },
    debates: entries,
    isMember,
  } satisfies CoalitionDebatesResponse)
}
