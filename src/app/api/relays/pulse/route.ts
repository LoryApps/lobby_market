import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PulseLeg {
  leg_id: string
  relay_id: string
  leg_number: number
  content: string
  side: 'for' | 'against'
  upvote_count: number
  created_at: string
  // Author
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  // Relay context
  relay_status: 'open' | 'in_progress' | 'complete' | 'voted'
  relay_max_legs: number
  relay_leg_count: number
  user_has_leg: boolean
  // Topic context
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
}

export interface PulseStats {
  legs_today: number
  active_contributors: number
  relays_completed_today: number
  most_active_category: string | null
}

export interface PulseResponse {
  legs: PulseLeg[]
  stats: PulseStats
  total: number
}

const VALID_SIDES = ['all', 'for', 'against'] as const
type Side = typeof VALID_SIDES[number]

// ─── GET /api/relays/pulse ────────────────────────────────────────────────────
// Returns the most recent relay leg contributions across the platform.
// Supports filtering by side and category.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const side = (VALID_SIDES.includes(searchParams.get('side') as Side)
    ? searchParams.get('side')
    : 'all') as Side
  const category = searchParams.get('category') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 60)

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // ─── Fetch recent relay legs ───────────────────────────────────────────────

  const legQuery = supabase
    .from('relay_legs')
    .select('id, relay_id, author_id, leg_number, content, upvote_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit * 3) // fetch extra to allow filtering after join

  const { data: legRows, error } = await legQuery

  if (error || !legRows || legRows.length === 0) {
    return NextResponse.json({ legs: [], stats: buildEmptyStats(), total: 0 })
  }

  // ─── Get relay IDs and fetch relay + topic data ────────────────────────────

  const relayIds = [...new Set(legRows.map((l) => l.relay_id as string))]

  const { data: relayRows } = await supabase
    .from('civic_relays')
    .select('id, side, status, max_legs, topic_id')
    .in('id', relayIds)

  const relayMap = new Map(
    (relayRows ?? []).map((r) => [r.id as string, r])
  )

  // Fetch topic info
  const topicIds = [...new Set(
    (relayRows ?? []).map((r) => r.topic_id as string | null).filter(Boolean)
  )] as string[]

  const { data: topicRows } = topicIds.length > 0
    ? await supabase
        .from('topics')
        .select('id, statement, category, status')
        .in('id', topicIds)
    : { data: [] }

  const topicMap = new Map(
    (topicRows ?? []).map((t) => [t.id as string, t])
  )

  // Fetch relay leg counts (how many legs filled per relay)
  const { data: legCountRows } = await supabase
    .from('relay_legs')
    .select('relay_id')
    .in('relay_id', relayIds)

  const legCountMap = new Map<string, number>()
  for (const row of legCountRows ?? []) {
    legCountMap.set(row.relay_id as string, (legCountMap.get(row.relay_id) ?? 0) + 1)
  }

  // Fetch user's contributed relays (to flag user_has_leg)
  const userRelayIds = new Set<string>()
  if (userId) {
    const { data: userLegs } = await supabase
      .from('relay_legs')
      .select('relay_id')
      .eq('author_id', userId)
      .in('relay_id', relayIds)
    for (const ul of userLegs ?? []) {
      userRelayIds.add(ul.relay_id as string)
    }
  }

  // Fetch author profiles
  const authorIds = [...new Set(legRows.map((l) => l.author_id as string))]

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', authorIds)

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p])
  )

  // ─── Assemble legs ─────────────────────────────────────────────────────────

  const legs: PulseLeg[] = []

  for (const leg of legRows) {
    const relay = relayMap.get(leg.relay_id as string)
    if (!relay) continue

    const topic = relay.topic_id ? topicMap.get(relay.topic_id as string) : null
    const author = profileMap.get(leg.author_id as string)

    // Apply side filter
    if (side !== 'all' && relay.side !== side) continue

    // Apply category filter
    if (category !== 'all' && topic?.category !== category) continue

    legs.push({
      leg_id: leg.id as string,
      relay_id: leg.relay_id as string,
      leg_number: leg.leg_number as number,
      content: leg.content as string,
      side: relay.side as 'for' | 'against',
      upvote_count: leg.upvote_count as number ?? 0,
      created_at: leg.created_at as string,
      author_id: leg.author_id as string,
      author_username: (author?.username as string) ?? 'unknown',
      author_display_name: (author?.display_name as string | null) ?? null,
      author_avatar_url: (author?.avatar_url as string | null) ?? null,
      author_role: (author?.role as string) ?? 'person',
      relay_status: relay.status as PulseLeg['relay_status'],
      relay_max_legs: relay.max_legs as number,
      relay_leg_count: legCountMap.get(relay.id as string) ?? 1,
      user_has_leg: userRelayIds.has(relay.id as string),
      topic_id: (relay.topic_id as string | null) ?? null,
      topic_statement: (topic?.statement as string | null) ?? null,
      topic_category: (topic?.category as string | null) ?? null,
      topic_status: (topic?.status as string | null) ?? null,
    })

    if (legs.length >= limit) break
  }

  // ─── Compute stats ─────────────────────────────────────────────────────────

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const { data: todayLegs } = await supabase
    .from('relay_legs')
    .select('author_id, relay_id')
    .gte('created_at', todayIso)

  const todayAuthorSet = new Set((todayLegs ?? []).map((l) => l.author_id as string))

  const { data: todayCompleted } = await supabase
    .from('civic_relays')
    .select('id, topic_id')
    .in('status', ['complete', 'voted'])
    .gte('completed_at', todayIso)

  // Most active category today
  const catCounts = new Map<string, number>()
  for (const relay of todayCompleted ?? []) {
    const topic = relay.topic_id ? topicMap.get(relay.topic_id as string) : null
    if (topic?.category) {
      catCounts.set(topic.category as string, (catCounts.get(topic.category) ?? 0) + 1)
    }
  }
  let mostActiveCategory: string | null = null
  let maxCount = 0
  for (const [cat, cnt] of catCounts) {
    if (cnt > maxCount) { maxCount = cnt; mostActiveCategory = cat }
  }

  const stats: PulseStats = {
    legs_today: todayLegs?.length ?? 0,
    active_contributors: todayAuthorSet.size,
    relays_completed_today: todayCompleted?.length ?? 0,
    most_active_category: mostActiveCategory,
  }

  return NextResponse.json({ legs, stats, total: legs.length } satisfies PulseResponse)
}

function buildEmptyStats(): PulseStats {
  return {
    legs_today: 0,
    active_contributors: 0,
    relays_completed_today: 0,
    most_active_category: null,
  }
}
