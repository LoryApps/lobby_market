import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopLeg {
  leg_id: string
  relay_id: string
  leg_number: number
  content: string
  side: 'for' | 'against'
  upvote_count: number
  user_upvoted: boolean
  created_at: string
  // Author
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  // Relay/topic context
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  relay_status: string
  relay_max_legs: number
  relay_leg_count: number
  relay_compelling_pct: number | null
}

export interface TopLegsResponse {
  legs: TopLeg[]
  total: number
}

const VALID_PERIODS = ['7d', '30d', 'all'] as const
type Period = typeof VALID_PERIODS[number]

const VALID_SIDES = ['all', 'for', 'against'] as const
type Side = typeof VALID_SIDES[number]

// ─── GET /api/relays/legs/top ─────────────────────────────────────────────────
// Returns the top-upvoted individual relay legs, filterable by side/category/period.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const side = (VALID_SIDES.includes(searchParams.get('side') as Side)
    ? searchParams.get('side')
    : 'all') as Side

  const category = searchParams.get('category') ?? 'all'
  const period = (VALID_PERIODS.includes(searchParams.get('period') as Period)
    ? searchParams.get('period')
    : '30d') as Period
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10), 50)

  // ─── Get current user (for user_upvoted check) ────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // ─── Date cutoff ──────────────────────────────────────────────────────────
  let cutoff: string | null = null
  if (period === '7d') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    cutoff = d.toISOString()
  } else if (period === '30d') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    cutoff = d.toISOString()
  }

  // ─── Fetch relay legs ordered by upvote_count ────────────────────────────
  let legQuery = supabase
    .from('relay_legs')
    .select('id, relay_id, author_id, leg_number, content, upvote_count, created_at')
    .order('upvote_count', { ascending: false })
    .gt('upvote_count', 0)
    .limit(limit * 4)  // fetch extra to allow for filtering by category/side

  if (cutoff) {
    legQuery = legQuery.gte('created_at', cutoff)
  }

  const { data: legRows } = await legQuery
  if (!legRows || legRows.length === 0) {
    return NextResponse.json({ legs: [], total: 0 } satisfies TopLegsResponse)
  }

  // ─── Fetch relay context ──────────────────────────────────────────────────
  const relayIds = [...new Set(legRows.map((l) => l.relay_id))]
  const { data: relayRows } = await supabase
    .from('civic_relays')
    .select('id, topic_id, side, status, max_legs, vote_compelling, vote_not_compelling')
    .in('id', relayIds)

  const relayMap = new Map((relayRows ?? []).map((r) => [r.id, r]))

  // ─── Fetch topic context ──────────────────────────────────────────────────
  const topicIds = [...new Set(
    (relayRows ?? [])
      .map((r) => r.topic_id)
      .filter(Boolean) as string[]
  )]

  const { data: topicRows } = topicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category')
        .in('id', topicIds)
    : { data: [] }

  const topicMap = new Map((topicRows ?? []).map((t) => [t.id, t]))

  // ─── Fetch author profiles ────────────────────────────────────────────────
  const authorIds = [...new Set(legRows.map((l) => l.author_id))]
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', authorIds)

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

  // ─── Fetch user's upvotes ─────────────────────────────────────────────────
  const legIds = legRows.map((l) => l.id)
  let upvotedSet = new Set<string>()
  if (userId) {
    const { data: upvoteRows } = await supabase
      .from('relay_leg_upvotes')
      .select('leg_id')
      .in('leg_id', legIds)
      .eq('voter_id', userId)
    upvotedSet = new Set((upvoteRows ?? []).map((u) => u.leg_id))
  }

  // ─── Count legs per relay (for context) ──────────────────────────────────
  const { data: legCountRows } = await supabase
    .from('relay_legs')
    .select('relay_id')
    .in('relay_id', relayIds)

  const legCountMap = new Map<string, number>()
  for (const l of legCountRows ?? []) {
    legCountMap.set(l.relay_id, (legCountMap.get(l.relay_id) ?? 0) + 1)
  }

  // ─── Build result legs ────────────────────────────────────────────────────
  const allLegs: TopLeg[] = []
  for (const leg of legRows) {
    const relay = relayMap.get(leg.relay_id)
    if (!relay) continue

    // Apply side filter
    if (side !== 'all' && relay.side !== side) continue

    const topic = relay.topic_id ? topicMap.get(relay.topic_id) : null

    // Apply category filter
    if (category !== 'all' && topic?.category !== category) continue

    const author = profileMap.get(leg.author_id)
    const totalVotes = (relay.vote_compelling ?? 0) + (relay.vote_not_compelling ?? 0)
    const compellingPct = totalVotes > 0
      ? Math.round((relay.vote_compelling / totalVotes) * 100)
      : null

    allLegs.push({
      leg_id: leg.id,
      relay_id: leg.relay_id,
      leg_number: leg.leg_number,
      content: leg.content,
      side: relay.side as 'for' | 'against',
      upvote_count: leg.upvote_count ?? 0,
      user_upvoted: upvotedSet.has(leg.id),
      created_at: leg.created_at,
      author_id: leg.author_id,
      author_username: author?.username ?? 'unknown',
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
      author_role: author?.role ?? 'person',
      topic_id: relay.topic_id ?? null,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      relay_status: relay.status,
      relay_max_legs: relay.max_legs,
      relay_leg_count: legCountMap.get(leg.relay_id) ?? 0,
      relay_compelling_pct: compellingPct,
    })

    if (allLegs.length >= limit) break
  }

  return NextResponse.json({
    legs: allLegs,
    total: allLegs.length,
  } satisfies TopLegsResponse)
}
