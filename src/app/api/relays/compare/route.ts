import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RelayLeg } from '@/app/api/relays/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompareRelay {
  id: string
  side: 'for' | 'against'
  status: string
  max_legs: number
  vote_compelling: number
  vote_not_compelling: number
  created_at: string
  completed_at: string | null
  leg_count: number
  legs: RelayLeg[]
  starter: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  user_vote: 'compelling' | 'not_compelling' | null
  compelling_pct: number
}

export interface CompareResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  for_relays: CompareRelay[]
  against_relays: CompareRelay[]
  for_total: number
  against_total: number
  battle_winner: 'for' | 'against' | 'tied' | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compellingPct(relay: { vote_compelling: number; vote_not_compelling: number }): number {
  const total = relay.vote_compelling + relay.vote_not_compelling
  return total > 0 ? Math.round((relay.vote_compelling / total) * 100) : 0
}

// ─── GET /api/relays/compare?topicId=<uuid> ───────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const topicId = searchParams.get('topicId')

  if (!topicId) {
    return NextResponse.json({ error: 'topicId required' }, { status: 400 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Fetch topic ─────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // ── Fetch all relays for this topic (all statuses, sorted best first) ───────
  const { data: relays, error } = await supabase
    .from('civic_relays')
    .select('id, side, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at, starter_id')
    .eq('topic_id', topicId)
    .order('vote_compelling', { ascending: false })

  if (error || !relays) {
    return NextResponse.json({ error: 'Failed to load relays' }, { status: 500 })
  }

  if (relays.length === 0) {
    return NextResponse.json({
      topic: { ...topic, blue_pct: topic.blue_pct ?? 50, total_votes: topic.total_votes ?? 0 },
      for_relays: [],
      against_relays: [],
      for_total: 0,
      against_total: 0,
      battle_winner: null,
    } satisfies CompareResponse)
  }

  // ── Collect starter IDs and relay IDs ────────────────────────────────────────
  const starterIds = [...new Set(relays.map((r) => r.starter_id))]
  const relayIds = relays.map((r) => r.id)

  // ── Batch fetch starters and legs ────────────────────────────────────────────
  const [startersResult, legsResult, userVotesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', starterIds),
    supabase
      .from('relay_legs')
      .select('id, relay_id, author_id, leg_number, content, created_at, upvote_count, profiles:author_id(id, username, display_name, avatar_url, role)')
      .in('relay_id', relayIds)
      .order('leg_number', { ascending: true }),
    user
      ? supabase
          .from('relay_votes')
          .select('relay_id, vote')
          .in('relay_id', relayIds)
          .eq('voter_id', user.id)
      : Promise.resolve({ data: [] }),
  ])

  const starterMap = new Map((startersResult.data ?? []).map((s) => [s.id, s]))
  const userVoteMap = new Map(
    ((userVotesResult as { data: Array<{ relay_id: string; vote: string }> | null }).data ?? []).map((v) => [v.relay_id, v.vote as 'compelling' | 'not_compelling'])
  )

  // Group legs by relay_id
  const legsByRelay = new Map<string, RelayLeg[]>()
  for (const leg of legsResult.data ?? []) {
    const list = legsByRelay.get(leg.relay_id) ?? []
    list.push({
      id: leg.id,
      relay_id: leg.relay_id,
      author_id: leg.author_id,
      leg_number: leg.leg_number,
      content: leg.content,
      created_at: leg.created_at,
      upvote_count: (leg as { upvote_count?: number }).upvote_count ?? 0,
      user_upvoted: false,
      author: (leg as { profiles?: RelayLeg['author'] }).profiles ?? null,
    })
    legsByRelay.set(leg.relay_id, list)
  }

  // ── Build compare relay objects ───────────────────────────────────────────────
  function buildCompareRelay(raw: typeof relays[0]): CompareRelay {
    const legs = legsByRelay.get(raw.id) ?? []
    return {
      id: raw.id,
      side: raw.side as 'for' | 'against',
      status: raw.status,
      max_legs: raw.max_legs,
      vote_compelling: raw.vote_compelling,
      vote_not_compelling: raw.vote_not_compelling,
      created_at: raw.created_at,
      completed_at: raw.completed_at,
      leg_count: legs.length,
      legs,
      starter: starterMap.get(raw.starter_id) ?? null,
      user_vote: userVoteMap.get(raw.id) ?? null,
      compelling_pct: compellingPct(raw),
    }
  }

  const forRelays = relays.filter((r) => r.side === 'for').map(buildCompareRelay)
  const againstRelays = relays.filter((r) => r.side === 'against').map(buildCompareRelay)

  // ── Determine battle winner ───────────────────────────────────────────────────
  const bestFor = forRelays[0]
  const bestAgainst = againstRelays[0]
  let battle_winner: CompareResponse['battle_winner'] = null

  if (bestFor && bestAgainst) {
    const diff = bestFor.compelling_pct - bestAgainst.compelling_pct
    if (Math.abs(diff) < 5) {
      battle_winner = 'tied'
    } else if (diff > 0) {
      battle_winner = 'for'
    } else {
      battle_winner = 'against'
    }
  }

  return NextResponse.json({
    topic: { ...topic, blue_pct: topic.blue_pct ?? 50, total_votes: topic.total_votes ?? 0 },
    for_relays: forRelays,
    against_relays: againstRelays,
    for_total: forRelays.length,
    against_total: againstRelays.length,
    battle_winner,
  } satisfies CompareResponse)
}
