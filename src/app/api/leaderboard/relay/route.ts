import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type RelayTier = 'relay_master' | 'chain_builder' | 'link' | 'newcomer'

export interface RelayLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  legs_written: number
  relays_started: number
  relays_completed: number
  compelling_votes: number
  total_relay_votes: number
  compelling_rate: number   // 0-100
  relay_score: number
  tier: RelayTier
}

export interface RelayMyStats {
  legs_written: number
  relays_started: number
  relays_completed: number
  compelling_rate: number
  relay_score: number
  tier: RelayTier
  rank: number | null
}

export interface RelayLeaderboardResponse {
  entries: RelayLeaderEntry[]
  total_participants: number
  platform_relays: number
  platform_legs: number
  my_stats: RelayMyStats | null
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(score: number): RelayTier {
  if (score >= 50) return 'relay_master'
  if (score >= 20) return 'chain_builder'
  if (score >= 8)  return 'link'
  return 'newcomer'
}

function calcScore(
  legs_written: number,
  relays_completed: number,
  compelling_rate: number,
  compelling_votes: number,
): number {
  return Math.round(
    legs_written * 2 +
    relays_completed * 5 +
    (compelling_rate / 100) * 10 +
    compelling_votes * 0.5,
  )
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Fetch all relay legs (contributors) ────────────────────────────────
  const { data: legRows, error: legErr } = await supabase
    .from('relay_legs')
    .select('relay_id, author_id, leg_number')
    .limit(20000)

  if (legErr || !legRows) {
    return NextResponse.json({
      entries: [],
      total_participants: 0,
      platform_relays: 0,
      platform_legs: 0,
      my_stats: null,
      generated_at: new Date().toISOString(),
    } satisfies RelayLeaderboardResponse)
  }

  // ── 2. Fetch all relays (for starter/completion info) ─────────────────────
  const { data: relayRows } = await supabase
    .from('civic_relays')
    .select('id, starter_id, status, vote_compelling, vote_not_compelling')
    .limit(10000)

  const relays = relayRows ?? []

  // Build relay lookup map: relayId → { starter_id, status, compelling, not }
  type RelayInfo = {
    starter_id: string
    status: string
    vote_compelling: number
    vote_not_compelling: number
  }
  const relayMap = new Map<string, RelayInfo>()
  for (const r of relays) {
    relayMap.set(r.id, {
      starter_id: r.starter_id,
      status: r.status,
      vote_compelling: r.vote_compelling ?? 0,
      vote_not_compelling: r.vote_not_compelling ?? 0,
    })
  }

  // ── 3. Aggregate per-user stats ───────────────────────────────────────────
  type UserRelayAgg = {
    legs_written: number
    relay_ids_contributed: Set<string>
  }

  const legAgg = new Map<string, UserRelayAgg>()

  for (const leg of legRows) {
    let agg = legAgg.get(leg.author_id)
    if (!agg) {
      agg = { legs_written: 0, relay_ids_contributed: new Set() }
      legAgg.set(leg.author_id, agg)
    }
    agg.legs_written++
    agg.relay_ids_contributed.add(leg.relay_id)
  }

  // ── 4. Aggregate relays started per user ──────────────────────────────────
  type UserStarterAgg = {
    relays_started: number
    relays_completed: number
    compelling_votes: number
    total_relay_votes: number
  }

  const starterAgg = new Map<string, UserStarterAgg>()

  for (const relay of relays) {
    let agg = starterAgg.get(relay.starter_id)
    if (!agg) {
      agg = {
        relays_started: 0,
        relays_completed: 0,
        compelling_votes: 0,
        total_relay_votes: 0,
      }
      starterAgg.set(relay.starter_id, agg)
    }
    agg.relays_started++
    if (relay.status === 'complete' || relay.status === 'voted') {
      agg.relays_completed++
      agg.compelling_votes += relay.vote_compelling ?? 0
      agg.total_relay_votes += (relay.vote_compelling ?? 0) + (relay.vote_not_compelling ?? 0)
    }
  }

  // ── 5. Merge and score ────────────────────────────────────────────────────
  const allUserIds = new Set([
    ...legAgg.keys(),
    ...starterAgg.keys(),
  ])

  type ScoredEntry = {
    user_id: string
    legs_written: number
    relays_started: number
    relays_completed: number
    compelling_votes: number
    total_relay_votes: number
    compelling_rate: number
    relay_score: number
  }

  const scored: ScoredEntry[] = []

  for (const uid of allUserIds) {
    const legs = legAgg.get(uid)
    const starter = starterAgg.get(uid)

    const legs_written = legs?.legs_written ?? 0
    const relays_started = starter?.relays_started ?? 0
    const relays_completed = starter?.relays_completed ?? 0
    const compelling_votes = starter?.compelling_votes ?? 0
    const total_relay_votes = starter?.total_relay_votes ?? 0

    if (legs_written === 0 && relays_started === 0) continue

    const compelling_rate =
      total_relay_votes > 0
        ? Math.round((compelling_votes / total_relay_votes) * 1000) / 10
        : 0

    const relay_score = calcScore(
      legs_written,
      relays_completed,
      compelling_rate,
      compelling_votes,
    )

    if (relay_score < 1) continue

    scored.push({
      user_id: uid,
      legs_written,
      relays_started,
      relays_completed,
      compelling_votes,
      total_relay_votes,
      compelling_rate,
      relay_score,
    })
  }

  scored.sort((a, b) => b.relay_score - a.relay_score)

  const total_participants = scored.length
  const top = scored.slice(0, 50)

  // ── 6. Fetch profiles ─────────────────────────────────────────────────────
  const userIds = top.map((e) => e.user_id)
  const profileMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', userIds)

    for (const p of (profiles ?? [])) {
      profileMap.set(p.id, p)
    }
  }

  // ── 7. Build response entries ──────────────────────────────────────────────
  const entries: RelayLeaderEntry[] = top
    .map((e, i) => {
      const profile = profileMap.get(e.user_id)
      if (!profile) return null
      return {
        rank: i + 1,
        user_id: e.user_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout ?? 0,
        legs_written: e.legs_written,
        relays_started: e.relays_started,
        relays_completed: e.relays_completed,
        compelling_votes: e.compelling_votes,
        total_relay_votes: e.total_relay_votes,
        compelling_rate: e.compelling_rate,
        relay_score: e.relay_score,
        tier: getTier(e.relay_score),
      } satisfies RelayLeaderEntry
    })
    .filter((e): e is RelayLeaderEntry => e !== null)

  // ── 8. Personal stats ──────────────────────────────────────────────────────
  let my_stats: RelayMyStats | null = null

  if (user) {
    const myIdx = scored.findIndex((e) => e.user_id === user.id)
    const myEntry = scored[myIdx]

    if (myEntry) {
      my_stats = {
        legs_written: myEntry.legs_written,
        relays_started: myEntry.relays_started,
        relays_completed: myEntry.relays_completed,
        compelling_rate: myEntry.compelling_rate,
        relay_score: myEntry.relay_score,
        tier: getTier(myEntry.relay_score),
        rank: myIdx + 1,
      }
    } else if (user) {
      // User exists but doesn't have relay activity yet
      const legs = legAgg.get(user.id)
      if (legs && legs.legs_written > 0) {
        my_stats = {
          legs_written: legs.legs_written,
          relays_started: 0,
          relays_completed: 0,
          compelling_rate: 0,
          relay_score: legs.legs_written * 2,
          tier: getTier(legs.legs_written * 2),
          rank: null,
        }
      }
    }
  }

  // ── 9. Platform-wide stats ─────────────────────────────────────────────────
  const platform_relays = relays.length
  const platform_legs = legRows.length

  return NextResponse.json({
    entries,
    total_participants,
    platform_relays,
    platform_legs,
    my_stats,
    generated_at: new Date().toISOString(),
  } satisfies RelayLeaderboardResponse)
}
