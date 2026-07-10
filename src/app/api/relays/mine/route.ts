import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RelayLeg } from '@/app/api/relays/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MyRelayStat {
  legs_written: number
  relays_started: number
  relays_completed: number
  compelling_votes: number
  not_compelling_votes: number
  compelling_rate: number | null
  leg_stars_received: number
}

export interface MyRelayEntry {
  relay_id: string
  relay_side: 'for' | 'against'
  relay_status: 'open' | 'in_progress' | 'complete' | 'voted'
  relay_created_at: string
  relay_completed_at: string | null
  relay_max_legs: number
  relay_vote_compelling: number
  relay_vote_not_compelling: number
  relay_started_by_me: boolean
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
  my_legs: RelayLeg[]
  all_legs_count: number
}

export interface MineRelaysResponse {
  stats: MyRelayStat
  entries: MyRelayEntry[]
  total: number
}

// ─── GET /api/relays/mine ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  // ── 1. My relay legs ──────────────────────────────────────────────────────

  const { data: myLegsRaw } = await supabase
    .from('relay_legs')
    .select('id, relay_id, leg_number, content, created_at, author_id, upvote_count')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (!myLegsRaw || myLegsRaw.length === 0) {
    return NextResponse.json({
      stats: {
        legs_written: 0,
        relays_started: 0,
        relays_completed: 0,
        compelling_votes: 0,
        not_compelling_votes: 0,
        compelling_rate: null,
        leg_stars_received: 0,
      },
      entries: [],
      total: 0,
    } satisfies MineRelaysResponse)
  }

  // Build per-relay leg map (all my legs)
  const myLegsByRelay = new Map<string, typeof myLegsRaw>()
  for (const leg of myLegsRaw) {
    const arr = myLegsByRelay.get(leg.relay_id) ?? []
    arr.push(leg)
    myLegsByRelay.set(leg.relay_id, arr)
  }

  const distinctRelayIds = Array.from(myLegsByRelay.keys())

  // ── 2. Fetch relay rows for those relay IDs ────────────────────────────────

  const { data: relayRows, count } = await supabase
    .from('civic_relays')
    .select('*', { count: 'exact' })
    .in('id', distinctRelayIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!relayRows || relayRows.length === 0) {
    return NextResponse.json({
      stats: {
        legs_written: myLegsRaw.length,
        relays_started: 0,
        relays_completed: 0,
        compelling_votes: 0,
        not_compelling_votes: 0,
        compelling_rate: null,
        leg_stars_received: myLegsRaw.reduce((sum, l) => sum + (l.upvote_count ?? 0), 0),
      },
      entries: [],
      total: 0,
    } satisfies MineRelaysResponse)
  }

  const pageRelayIds = relayRows.map((r) => r.id)

  // ── 3. Topic info ──────────────────────────────────────────────────────────

  const topicIds = relayRows.map((r) => r.topic_id).filter(Boolean) as string[]
  const { data: topics } =
    topicIds.length > 0
      ? await supabase
          .from('topics')
          .select('id, statement, category, status')
          .in('id', topicIds)
      : { data: [] }

  const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

  // ── 4. All legs (for count) and my legs with author stub ──────────────────

  const { data: allLegsRaw } = await supabase
    .from('relay_legs')
    .select('relay_id, id, leg_number, content, created_at, author_id')
    .in('relay_id', pageRelayIds)
    .order('leg_number', { ascending: true })

  const allLegCountByRelay = new Map<string, number>()
  for (const leg of allLegsRaw ?? []) {
    allLegCountByRelay.set(leg.relay_id, (allLegCountByRelay.get(leg.relay_id) ?? 0) + 1)
  }

  // ── 5. Stats across ALL relays (not just page) ─────────────────────────────

  const completedRelayIds = new Set<string>()
  let totalCompelling = 0
  let totalNotCompelling = 0

  // We need to fetch compelling/not_compelling for ALL relays I've contributed to
  const { data: allMyRelayRows } = await supabase
    .from('civic_relays')
    .select('id, status, starter_id, vote_compelling, vote_not_compelling')
    .in('id', distinctRelayIds)

  let relaysStartedByMe = 0
  for (const r of allMyRelayRows ?? []) {
    if (r.starter_id === user.id) relaysStartedByMe++
    if (r.status === 'complete' || r.status === 'voted') {
      completedRelayIds.add(r.id)
      totalCompelling += r.vote_compelling ?? 0
      totalNotCompelling += r.vote_not_compelling ?? 0
    }
  }

  const totalVotes = totalCompelling + totalNotCompelling
  const compelling_rate = totalVotes > 0 ? Math.round((totalCompelling / totalVotes) * 100) : null
  const leg_stars_received = myLegsRaw.reduce((sum, l) => sum + (l.upvote_count ?? 0), 0)

  const stats: MyRelayStat = {
    legs_written: myLegsRaw.length,
    relays_started: relaysStartedByMe,
    relays_completed: completedRelayIds.size,
    compelling_votes: totalCompelling,
    not_compelling_votes: totalNotCompelling,
    compelling_rate,
    leg_stars_received,
  }

  // ── 6. Assemble entries ───────────────────────────────────────────────────

  const myAuthorStub: RelayLeg['author'] = {
    id: user.id,
    username: '',
    display_name: null,
    avatar_url: null,
    role: 'citizen',
  }

  // Fetch current user profile for name/avatar
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  const authorStub: RelayLeg['author'] = myProfile
    ? {
        id: user.id,
        username: myProfile.username ?? '',
        display_name: myProfile.display_name,
        avatar_url: myProfile.avatar_url,
        role: myProfile.role ?? 'citizen',
      }
    : myAuthorStub

  const relayRowMap = new Map((allMyRelayRows ?? []).map((r) => [r.id, r]))

  const entries: MyRelayEntry[] = relayRows.map((r) => {
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null
    const myLegsForRelay = (myLegsByRelay.get(r.id) ?? []).map((leg) => ({
      id: leg.id,
      relay_id: leg.relay_id,
      author_id: leg.author_id,
      leg_number: leg.leg_number,
      content: leg.content,
      created_at: leg.created_at,
      upvote_count: leg.upvote_count ?? 0,
      user_upvoted: false,
      author: authorStub,
    }))
    const fullRow = relayRowMap.get(r.id)

    return {
      relay_id: r.id,
      relay_side: r.side as 'for' | 'against',
      relay_status: r.status as 'open' | 'in_progress' | 'complete' | 'voted',
      relay_created_at: r.created_at,
      relay_completed_at: r.completed_at ?? null,
      relay_max_legs: r.max_legs,
      relay_vote_compelling: fullRow?.vote_compelling ?? r.vote_compelling ?? 0,
      relay_vote_not_compelling: fullRow?.vote_not_compelling ?? r.vote_not_compelling ?? 0,
      relay_started_by_me: r.starter_id === user.id,
      topic_id: r.topic_id ?? null,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? null,
      my_legs: myLegsForRelay,
      all_legs_count: allLegCountByRelay.get(r.id) ?? 0,
    }
  })

  return NextResponse.json({
    stats,
    entries,
    total: count ?? distinctRelayIds.length,
  } satisfies MineRelaysResponse)
}
