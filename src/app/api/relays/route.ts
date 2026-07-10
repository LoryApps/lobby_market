import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayLeg {
  id: string
  relay_id: string
  author_id: string
  leg_number: number
  content: string
  created_at: string
  upvote_count: number
  user_upvoted: boolean
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface RelayRow {
  id: string
  topic_id: string | null
  side: 'for' | 'against'
  starter_id: string
  status: 'open' | 'in_progress' | 'complete' | 'voted'
  max_legs: number
  vote_compelling: number
  vote_not_compelling: number
  created_at: string
  completed_at: string | null
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  legs: RelayLeg[]
  user_vote: 'compelling' | 'not_compelling' | null
  user_has_leg: boolean
}

export interface RelaysResponse {
  relays: RelayRow[]
  total: number
}

type StatusFilter = 'open' | 'in_progress' | 'complete' | 'all'

// ─── GET /api/relays ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const statusFilter = (searchParams.get('status') ?? 'all') as StatusFilter
  const topicId = searchParams.get('topic_id') ?? null
  const sideFilter = searchParams.get('side') ?? 'all'
  const categoryFilter = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ─── Resolve category filter to topic IDs ────────────────────────────────

  let categoryTopicIds: string[] | null = null
  if (categoryFilter) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('id')
      .eq('category', categoryFilter)
    categoryTopicIds = (catTopics ?? []).map((t) => t.id)
  }

  // ─── Fetch relays ─────────────────────────────────────────────────────────

  let query = supabase
    .from('civic_relays')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }
  if (topicId) {
    query = query.eq('topic_id', topicId)
  }
  if (sideFilter === 'for' || sideFilter === 'against') {
    query = query.eq('side', sideFilter)
  }
  if (categoryTopicIds !== null) {
    if (categoryTopicIds.length === 0) {
      return NextResponse.json({ relays: [], total: 0 } satisfies RelaysResponse)
    }
    query = query.in('topic_id', categoryTopicIds)
  }

  const { data: rawRelays, count } = await query

  if (!rawRelays || rawRelays.length === 0) {
    return NextResponse.json({ relays: [], total: count ?? 0 } satisfies RelaysResponse)
  }

  const relayIds = rawRelays.map((r) => r.id)

  // ─── Fetch starters ───────────────────────────────────────────────────────

  const starterIds = [...new Set(rawRelays.map((r) => r.starter_id))]
  const { data: starters } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', starterIds)

  const starterMap = new Map(starters?.map((s) => [s.id, s]) ?? [])

  // ─── Fetch topic info ─────────────────────────────────────────────────────

  const topicIds = rawRelays.map((r) => r.topic_id).filter(Boolean) as string[]
  const { data: topics } =
    topicIds.length > 0
      ? await supabase
          .from('topics')
          .select('id, statement, category, status')
          .in('id', topicIds)
      : { data: [] }

  const topicMap = new Map(topics?.map((t) => [t.id, t]) ?? [])

  // ─── Fetch relay legs with authors ───────────────────────────────────────

  const { data: legsRaw } = await supabase
    .from('relay_legs')
    .select('*, profiles:author_id(id, username, display_name, avatar_url, role)')
    .in('relay_id', relayIds)
    .order('leg_number', { ascending: true })

  const legsByRelay = new Map<string, RelayLeg[]>()
  for (const leg of legsRaw ?? []) {
    const author = (leg as { profiles?: unknown }).profiles as RelayLeg['author'] | null
    const cleaned: RelayLeg = {
      id: leg.id,
      relay_id: leg.relay_id,
      author_id: leg.author_id,
      leg_number: leg.leg_number,
      content: leg.content,
      created_at: leg.created_at,
      upvote_count: (leg as { upvote_count?: number }).upvote_count ?? 0,
      user_upvoted: false,
      author,
    }
    const arr = legsByRelay.get(leg.relay_id) ?? []
    arr.push(cleaned)
    legsByRelay.set(leg.relay_id, arr)
  }

  // ─── Fetch user votes ─────────────────────────────────────────────────────

  const userVoteMap = new Map<string, 'compelling' | 'not_compelling'>()
  const userLegRelayIds = new Set<string>()

  if (user) {
    const { data: uVotes } = await supabase
      .from('relay_votes')
      .select('relay_id, vote')
      .eq('voter_id', user.id)
      .in('relay_id', relayIds)

    for (const v of uVotes ?? []) {
      userVoteMap.set(v.relay_id, v.vote as 'compelling' | 'not_compelling')
    }

    const { data: uLegs } = await supabase
      .from('relay_legs')
      .select('relay_id')
      .eq('author_id', user.id)
      .in('relay_id', relayIds)

    for (const l of uLegs ?? []) {
      userLegRelayIds.add(l.relay_id)
    }
  }

  // ─── Assemble ─────────────────────────────────────────────────────────────

  const relays: RelayRow[] = rawRelays.map((r) => {
    const starter = starterMap.get(r.starter_id)
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null

    return {
      id: r.id,
      topic_id: r.topic_id,
      side: r.side as 'for' | 'against',
      starter_id: r.starter_id,
      status: r.status as RelayRow['status'],
      max_legs: r.max_legs,
      vote_compelling: r.vote_compelling,
      vote_not_compelling: r.vote_not_compelling,
      created_at: r.created_at,
      completed_at: r.completed_at,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? null,
      starter_username: starter?.username ?? 'unknown',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      starter_role: starter?.role ?? 'person',
      legs: legsByRelay.get(r.id) ?? [],
      user_vote: userVoteMap.get(r.id) ?? null,
      user_has_leg: userLegRelayIds.has(r.id),
    }
  })

  return NextResponse.json({ relays, total: count ?? 0 } satisfies RelaysResponse)
}

// ─── POST /api/relays — Start a new relay ────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    topic_id?: string | null
    side: 'for' | 'against'
    content: string
  }

  const { topic_id, side, content } = body

  if (!side || !['for', 'against'].includes(side)) {
    return NextResponse.json({ error: 'Invalid side' }, { status: 400 })
  }

  if (!content || content.trim().length < 30 || content.trim().length > 300) {
    return NextResponse.json(
      { error: 'First leg must be 30–300 characters' },
      { status: 400 }
    )
  }

  // Create relay
  const { data: relay, error: relayErr } = await supabase
    .from('civic_relays')
    .insert({
      topic_id: topic_id ?? null,
      side,
      starter_id: user.id,
      status: 'open',
    })
    .select('id')
    .single()

  if (relayErr || !relay) {
    return NextResponse.json({ error: 'Failed to create relay' }, { status: 500 })
  }

  // Add the first leg
  const { error: legErr } = await supabase.from('relay_legs').insert({
    relay_id: relay.id,
    author_id: user.id,
    leg_number: 1,
    content: content.trim(),
  })

  if (legErr) {
    return NextResponse.json({ error: 'Failed to add first leg' }, { status: 500 })
  }

  // Move to in_progress
  await supabase
    .from('civic_relays')
    .update({ status: 'in_progress' })
    .eq('id', relay.id)

  return NextResponse.json({ relay_id: relay.id }, { status: 201 })
}
