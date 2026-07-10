import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpotlightLeg {
  id: string
  leg_number: number
  content: string
  upvote_count: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface SpotlightRelay {
  id: string
  side: 'for' | 'against'
  status: 'open' | 'in_progress'
  max_legs: number
  leg_count: number
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  latest_leg: SpotlightLeg | null
  user_has_leg: boolean
}

// ─── GET /api/relays/spotlight ────────────────────────────────────────────────
// Returns a single open/in-progress relay chain to feature in the feed.
// Prefers relays with at least one leg that the current user hasn't contributed
// to yet, ordered by most recently active.

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // Fetch up to 20 open/in-progress relays, most recent first
  const { data: rows, error } = await supabase
    .from('civic_relays')
    .select('id, side, status, max_legs, topic_id, starter_id, created_at, vote_compelling, vote_not_compelling')
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ relay: null })
  }

  const relayIds = (rows as { id: string }[]).map((r) => r.id)

  // Fetch all legs for these relays (upvote_count is denormalised on relay_legs)
  const { data: allLegs } = await supabase
    .from('relay_legs')
    .select(`
      id,
      relay_id,
      leg_number,
      content,
      upvote_count,
      author_id,
      profiles:author_id ( username, display_name, avatar_url )
    `)
    .in('relay_id', relayIds)
    .order('leg_number', { ascending: true })

  // Group legs by relay
  type LegRow = NonNullable<typeof allLegs>[number]
  const legsByRelay = new Map<string, LegRow[]>()
  for (const leg of allLegs ?? []) {
    const rid = leg.relay_id as string
    const arr = legsByRelay.get(rid) ?? []
    arr.push(leg as LegRow)
    legsByRelay.set(rid, arr)
  }

  // Fetch topics
  const topicIds = Array.from(
    new Set((rows as { topic_id: string | null }[]).map((r) => r.topic_id).filter(Boolean) as string[])
  )
  const topicMap = new Map<string, { id: string; statement: string; category: string | null }>()
  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds)
    for (const t of topicRows ?? []) topicMap.set(t.id as string, t as { id: string; statement: string; category: string | null })
  }

  // Fetch starters
  const starterIds = Array.from(
    new Set((rows as { starter_id: string }[]).map((r) => r.starter_id))
  )
  const starterMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }>()
  if (starterIds.length > 0) {
    const { data: starterRows } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', starterIds)
    for (const s of starterRows ?? []) {
      starterMap.set(s.id as string, s as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string })
    }
  }

  // Build candidates
  const candidates: SpotlightRelay[] = []

  for (const row of rows as {
    id: string
    side: string
    status: string
    max_legs: number
    topic_id: string | null
    starter_id: string
  }[]) {
    const legs = legsByRelay.get(row.id) ?? []
    const userHasLeg = userId ? legs.some((l) => l.author_id === userId) : false

    // Skip relays started by the current user
    if (userId && row.starter_id === userId) continue

    const topic = row.topic_id ? (topicMap.get(row.topic_id) ?? null) : null
    const starter = starterMap.get(row.starter_id) ?? null

    const latestLegRaw = legs.length > 0 ? legs[legs.length - 1] : null
    type LegProfile = { username?: string; display_name?: string | null; avatar_url?: string | null } | null
    const latestLeg: SpotlightLeg | null = latestLegRaw
      ? {
          id: latestLegRaw.id as string,
          leg_number: latestLegRaw.leg_number as number,
          content: latestLegRaw.content as string,
          upvote_count: (latestLegRaw.upvote_count as number | null) ?? 0,
          author_username: ((latestLegRaw.profiles as LegProfile)?.username) ?? 'unknown',
          author_display_name: ((latestLegRaw.profiles as LegProfile)?.display_name) ?? null,
          author_avatar_url: ((latestLegRaw.profiles as LegProfile)?.avatar_url) ?? null,
        }
      : null

    candidates.push({
      id: row.id,
      side: row.side as 'for' | 'against',
      status: row.status as 'open' | 'in_progress',
      max_legs: row.max_legs ?? 5,
      leg_count: legs.length,
      topic_id: row.topic_id ?? null,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      starter_username: starter?.username ?? 'unknown',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      starter_role: starter?.role ?? 'person',
      latest_leg: latestLeg,
      user_has_leg: userHasLeg,
    })
  }

  if (candidates.length === 0) {
    return NextResponse.json({ relay: null })
  }

  // Prefer relays the user hasn't contributed to, with at least one leg for context
  const withLegs = candidates.filter((c) => !c.user_has_leg && c.leg_count > 0)
  const fresh = candidates.filter((c) => !c.user_has_leg)
  const chosen = withLegs[0] ?? fresh[0] ?? candidates[0]

  return NextResponse.json({ relay: chosen })
}
