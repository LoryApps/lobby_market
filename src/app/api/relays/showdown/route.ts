import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RelayLeg } from '@/app/api/relays/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShowdownRelay {
  id: string
  side: 'for' | 'against'
  status: 'complete' | 'voted'
  max_legs: number
  vote_compelling: number
  vote_not_compelling: number
  created_at: string
  completed_at: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  legs: RelayLeg[]
  user_vote: 'compelling' | 'not_compelling' | null
}

export interface ShowdownPair {
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number | null
  for_relay: ShowdownRelay
  against_relay: ShowdownRelay
}

export interface ShowdownResponse {
  pairs: ShowdownPair[]
  total: number
  page: number
  per_page: number
}

// ─── GET /api/relays/showdown ─────────────────────────────────────────────────
// Returns topic pairs where both a completed FOR and AGAINST relay exist.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const perPage = 10
  const offset = (page - 1) * perPage

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Pull all completed/voted relays on topics that have at least one relay
  // on each side. We collect them in JS since doing a self-join is not
  // straightforward with the Supabase query builder.
  const { data: allRelays, error } = await supabase
    .from('civic_relays')
    .select('id, topic_id, side, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at, starter_id')
    .in('status', ['complete', 'voted'])
    .not('topic_id', 'is', null)
    .order('completed_at', { ascending: false })

  if (error || !allRelays) {
    return NextResponse.json({ error: 'Failed to load relays' }, { status: 500 })
  }

  // Group by topic_id, collect first FOR and AGAINST
  const forByTopic = new Map<string, typeof allRelays[0]>()
  const againstByTopic = new Map<string, typeof allRelays[0]>()

  for (const relay of allRelays) {
    if (!relay.topic_id) continue
    if (relay.side === 'for' && !forByTopic.has(relay.topic_id)) {
      forByTopic.set(relay.topic_id, relay)
    } else if (relay.side === 'against' && !againstByTopic.has(relay.topic_id)) {
      againstByTopic.set(relay.topic_id, relay)
    }
  }

  // Find topics with BOTH sides
  const pairedTopicIds: string[] = []
  for (const topicId of forByTopic.keys()) {
    if (againstByTopic.has(topicId)) {
      pairedTopicIds.push(topicId)
    }
  }

  const total = pairedTopicIds.length
  const pagedTopicIds = pairedTopicIds.slice(offset, offset + perPage)

  if (pagedTopicIds.length === 0) {
    return NextResponse.json({ pairs: [], total, page, per_page: perPage } satisfies ShowdownResponse)
  }

  // Fetch topic metadata
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct')
    .in('id', pagedTopicIds)

  const topicMap = new Map<string, { statement: string; category: string | null; status: string; blue_pct: number | null }>(
    (topics ?? []).map((t) => [t.id, { statement: t.statement, category: t.category, status: t.status, blue_pct: t.blue_pct }])
  )

  // Collect all relay IDs we need legs for
  const relayIds: string[] = []
  for (const topicId of pagedTopicIds) {
    const fr = forByTopic.get(topicId)
    const ar = againstByTopic.get(topicId)
    if (fr) relayIds.push(fr.id)
    if (ar) relayIds.push(ar.id)
  }

  // Fetch legs for all relays in batch
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
      author,
    }
    if (!legsByRelay.has(leg.relay_id)) legsByRelay.set(leg.relay_id, [])
    legsByRelay.get(leg.relay_id)!.push(cleaned)
  }

  // Fetch starter profiles for all relay starters in batch
  const starterIds = new Set<string>()
  for (const topicId of pagedTopicIds) {
    const fr = forByTopic.get(topicId)
    const ar = againstByTopic.get(topicId)
    if (fr?.starter_id) starterIds.add(fr.starter_id)
    if (ar?.starter_id) starterIds.add(ar.starter_id)
  }

  const { data: starterProfiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', Array.from(starterIds))

  const starterMap = new Map(
    (starterProfiles ?? []).map((p) => [p.id, p])
  )

  // Fetch user votes for these relays
  const userVoteMap = new Map<string, 'compelling' | 'not_compelling'>()
  if (user && relayIds.length > 0) {
    const { data: votes } = await supabase
      .from('relay_votes')
      .select('relay_id, vote')
      .eq('voter_id', user.id)
      .in('relay_id', relayIds)
    for (const v of votes ?? []) {
      userVoteMap.set(v.relay_id, v.vote as 'compelling' | 'not_compelling')
    }
  }

  function buildShowdownRelay(raw: typeof allRelays[0]): ShowdownRelay {
    const starter = starterMap.get(raw.starter_id)
    return {
      id: raw.id,
      side: raw.side as 'for' | 'against',
      status: raw.status as 'complete' | 'voted',
      max_legs: raw.max_legs,
      vote_compelling: raw.vote_compelling ?? 0,
      vote_not_compelling: raw.vote_not_compelling ?? 0,
      created_at: raw.created_at,
      completed_at: raw.completed_at ?? null,
      starter_username: starter?.username ?? 'unknown',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      starter_role: starter?.role ?? 'person',
      legs: legsByRelay.get(raw.id) ?? [],
      user_vote: userVoteMap.get(raw.id) ?? null,
    }
  }

  const pairs: ShowdownPair[] = pagedTopicIds
    .map((topicId) => {
      const fr = forByTopic.get(topicId)
      const ar = againstByTopic.get(topicId)
      if (!fr || !ar) return null
      const topic = topicMap.get(topicId)
      if (!topic) return null
      return {
        topic_id: topicId,
        topic_statement: topic.statement,
        topic_category: topic.category,
        topic_status: topic.status,
        topic_blue_pct: topic.blue_pct,
        for_relay: buildShowdownRelay(fr),
        against_relay: buildShowdownRelay(ar),
      }
    })
    .filter(Boolean) as ShowdownPair[]

  return NextResponse.json({ pairs, total, page, per_page: perPage } satisfies ShowdownResponse)
}
