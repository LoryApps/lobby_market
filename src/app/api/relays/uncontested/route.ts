import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UncontestedRelay {
  relay_id: string
  relay_status: 'complete' | 'voted'
  relay_side: 'for' | 'against'
  relay_created_at: string
  relay_completed_at: string | null
  vote_compelling: number
  vote_not_compelling: number
  max_legs: number
  leg_count: number
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number | null
  topic_total_votes: number | null
  missing_side: 'for' | 'against'
}

export interface UncontestedResponse {
  entries: UncontestedRelay[]
  total: number
}

// ─── GET /api/relays/uncontested ──────────────────────────────────────────────
// Returns completed relays for topics where only one side (FOR or AGAINST)
// has a relay chain.  Each entry signals an opportunity to "argue the other side."

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const missing = searchParams.get('missing') ?? 'all' // 'for' | 'against' | 'all'
  const sort = searchParams.get('sort') ?? 'votes'     // 'votes' | 'newest' | 'compelling'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = 12

  // Fetch all completed/voted relays with a topic_id
  const { data: allRelays } = await supabase
    .from('civic_relays')
    .select('id, topic_id, side, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at, starter_id')
    .in('status', ['complete', 'voted'])
    .not('topic_id', 'is', null)

  if (!allRelays || allRelays.length === 0) {
    return NextResponse.json({ entries: [], total: 0 } satisfies UncontestedResponse)
  }

  // Build a map: topic_id → set of sides that have a completed relay
  const topicSidesMap = new Map<string, Set<string>>()
  for (const r of allRelays) {
    if (!r.topic_id) continue
    if (!topicSidesMap.has(r.topic_id)) topicSidesMap.set(r.topic_id, new Set())
    topicSidesMap.get(r.topic_id)!.add(r.side)
  }

  // Keep only relays where the topic has exactly ONE side covered
  const uncontested = allRelays.filter((r) => {
    if (!r.topic_id) return false
    const sides = topicSidesMap.get(r.topic_id)
    return sides && sides.size === 1
  })

  if (uncontested.length === 0) {
    return NextResponse.json({ entries: [], total: 0 } satisfies UncontestedResponse)
  }

  // Collect unique topic IDs and starter IDs
  const topicIds = [...new Set(uncontested.map((r) => r.topic_id).filter(Boolean))] as string[]
  const starterIds = [...new Set(uncontested.map((r) => r.starter_id))]

  // Batch fetch topics
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)
  const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

  // Batch fetch starters
  const { data: starters } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', starterIds)
  const starterMap = new Map((starters ?? []).map((p) => [p.id, p]))

  // Batch fetch leg counts
  const relayIds = uncontested.map((r) => r.id)
  const { data: legRows } = await supabase
    .from('relay_legs')
    .select('relay_id')
    .in('relay_id', relayIds)
  const legCountMap = new Map<string, number>()
  for (const l of legRows ?? []) {
    legCountMap.set(l.relay_id, (legCountMap.get(l.relay_id) ?? 0) + 1)
  }

  // Build enriched entries
  const entries: UncontestedRelay[] = []
  for (const r of uncontested) {
    if (!r.topic_id) continue
    const topic = topicMap.get(r.topic_id)
    if (!topic) continue
    const starter = starterMap.get(r.starter_id)
    if (!starter) continue

    // Apply category filter
    if (category && topic.category !== category) continue

    const missingSide = r.side === 'for' ? 'against' : 'for'

    // Apply missing-side filter
    if (missing === 'for' && missingSide !== 'for') continue
    if (missing === 'against' && missingSide !== 'against') continue

    entries.push({
      relay_id: r.id,
      relay_status: r.status as 'complete' | 'voted',
      relay_side: r.side as 'for' | 'against',
      relay_created_at: r.created_at,
      relay_completed_at: r.completed_at,
      vote_compelling: r.vote_compelling,
      vote_not_compelling: r.vote_not_compelling,
      max_legs: r.max_legs,
      leg_count: legCountMap.get(r.id) ?? 0,
      starter_username: starter.username,
      starter_display_name: starter.display_name,
      starter_avatar_url: starter.avatar_url,
      topic_id: r.topic_id,
      topic_statement: topic.statement,
      topic_category: topic.category,
      topic_status: topic.status,
      topic_blue_pct: topic.blue_pct,
      topic_total_votes: topic.total_votes,
      missing_side: missingSide,
    })
  }

  // Sort
  if (sort === 'votes') {
    entries.sort((a, b) => (b.topic_total_votes ?? 0) - (a.topic_total_votes ?? 0))
  } else if (sort === 'newest') {
    entries.sort((a, b) => new Date(b.relay_created_at).getTime() - new Date(a.relay_created_at).getTime())
  } else if (sort === 'compelling') {
    entries.sort((a, b) => {
      const aTotal = a.vote_compelling + a.vote_not_compelling
      const bTotal = b.vote_compelling + b.vote_not_compelling
      const aPct = aTotal > 0 ? a.vote_compelling / aTotal : 0
      const bPct = bTotal > 0 ? b.vote_compelling / bTotal : 0
      return bPct - aPct
    })
  }

  const total = entries.length
  const paginated = entries.slice((page - 1) * perPage, page * perPage)

  return NextResponse.json({ entries: paginated, total } satisfies UncontestedResponse)
}
