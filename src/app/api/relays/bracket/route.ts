import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BracketRelay {
  id: string
  seed: number
  side: 'for' | 'against'
  status: 'complete' | 'voted'
  max_legs: number
  leg_count: number
  vote_compelling: number
  vote_not_compelling: number
  total_leg_stars: number
  compelling_pct: number | null
  bracket_score: number
  created_at: string
  completed_at: string | null
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  opener_content: string | null
}

export interface BracketMatchup {
  match_id: number
  higher_seed: BracketRelay
  lower_seed: BracketRelay
  winner_seed: number | null // null = too close to call / not yet determined
  status: 'live' | 'decided' | 'tied'
}

export interface BracketRound {
  round: number
  label: 'Quarterfinals' | 'Semifinals' | 'Final'
  matchups: BracketMatchup[]
}

export interface BracketResponse {
  week_label: string
  week_start_iso: string
  seeds: BracketRelay[]
  rounds: BracketRound[]
  champion: BracketRelay | null
  total_votes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bracketScore(r: {
  vote_compelling: number
  vote_not_compelling: number
  total_leg_stars: number
}): number {
  const totalVotes = r.vote_compelling + r.vote_not_compelling
  const credibility = Math.min(totalVotes / 3, 1)
  const compellingRate = totalVotes > 0 ? r.vote_compelling / totalVotes : 0.5
  return Math.round(
    compellingRate * 100 * credibility +
    r.total_leg_stars * 2 +
    r.vote_compelling * 5
  )
}

function weekBounds(): { weekStartIso: string; weekLabel: string } {
  const now = new Date()
  const dow = now.getUTCDay() // 0=Sun
  const weekStart = new Date(now)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((dow + 6) % 7)) // Monday
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekStartIso = weekStart.toISOString()

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const label = `${fmt(weekStart)}–${fmt(weekEnd)}, ${weekStart.getFullYear()}`

  return { weekStartIso, weekLabel: label }
}

function getMatchWinner(higher: BracketRelay, lower: BracketRelay): {
  winner_seed: number | null
  status: 'live' | 'decided' | 'tied'
} {
  const highTotal = higher.vote_compelling + higher.vote_not_compelling
  const lowTotal = lower.vote_compelling + lower.vote_not_compelling
  if (highTotal < 2 && lowTotal < 2) return { winner_seed: null, status: 'live' }

  const highPct = highTotal > 0 ? higher.vote_compelling / highTotal : 0.5
  const lowPct = lowTotal > 0 ? lower.vote_compelling / lowTotal : 0.5
  const diff = Math.abs(highPct - lowPct)

  if (diff < 0.05) return { winner_seed: null, status: 'tied' }

  const winner = highPct > lowPct ? higher : lower
  return { winner_seed: winner.seed, status: 'decided' }
}

// Standard bracket seeding: 1v8, 4v5, 2v7, 3v6
const QF_PAIRS: [number, number][] = [
  [1, 8],
  [4, 5],
  [2, 7],
  [3, 6],
]

// ─── GET /api/relays/bracket ──────────────────────────────────────────────────
// Returns the weekly bracket: top 8 completed relay chains seeded by score,
// arranged in a single-elimination tournament bracket.

export async function GET() {
  const supabase = await createClient()
  const { weekStartIso, weekLabel } = weekBounds()

  // Fetch completed relays — prefer current week; fall back to all-time
  const fetchRelays = async (since: string | null) => {
    let q = supabase
      .from('civic_relays')
      .select('id, side, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at, topic_id, starter_id')
      .in('status', ['complete', 'voted'])
      .order('vote_compelling', { ascending: false })
      .limit(40)

    if (since) q = q.gte('completed_at', since)
    const { data, error } = await q
    return { data: data ?? [], error }
  }

  let { data: rawRelays } = await fetchRelays(weekStartIso)

  // Not enough entries this week → fall back to all-time top 8
  if (rawRelays.length < 4) {
    const { data: allTime } = await fetchRelays(null)
    rawRelays = allTime
  }

  if (rawRelays.length === 0) {
    return NextResponse.json({
      week_label: weekLabel,
      week_start_iso: weekStartIso,
      seeds: [],
      rounds: [],
      champion: null,
      total_votes: 0,
    } satisfies BracketResponse)
  }

  // ─── Fetch relay legs (first leg = opener) ────────────────────────────────

  const relayIds = rawRelays.map((r) => r.id)
  const { data: allLegs } = await supabase
    .from('relay_legs')
    .select('id, relay_id, leg_number, content, upvote_count, author_id')
    .in('relay_id', relayIds)
    .order('leg_number', { ascending: true })

  // Group legs by relay
  const legsByRelay = new Map<string, typeof allLegs>()
  for (const leg of allLegs ?? []) {
    const arr = legsByRelay.get(leg.relay_id) ?? []
    arr.push(leg)
    legsByRelay.set(leg.relay_id, arr)
  }

  // ─── Fetch starters ───────────────────────────────────────────────────────

  const starterIds = [...new Set(rawRelays.map((r) => r.starter_id).filter(Boolean))] as string[]
  const { data: starterProfiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', starterIds)
  const starterMap = new Map((starterProfiles ?? []).map((p) => [p.id, p]))

  // ─── Fetch topics ─────────────────────────────────────────────────────────

  const topicIds = [...new Set(rawRelays.map((r) => r.topic_id).filter(Boolean))] as string[]
  const topicMap = new Map<string, { statement: string; category: string | null }>()
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds)
    for (const t of topics ?? []) topicMap.set(t.id, t)
  }

  // ─── Build + score ────────────────────────────────────────────────────────

  const scored = rawRelays.map((r) => {
    const legs = legsByRelay.get(r.id) ?? []
    const total_leg_stars = legs.reduce((s, l) => s + (l.upvote_count ?? 0), 0)
    const opener = legs.find((l) => l.leg_number === 1)
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null
    const starter = starterMap.get(r.starter_id)
    const totalVotes = r.vote_compelling + r.vote_not_compelling

    return {
      id: r.id,
      seed: 0, // assigned below
      side: r.side as 'for' | 'against',
      status: r.status as 'complete' | 'voted',
      max_legs: r.max_legs,
      leg_count: legs.length,
      vote_compelling: r.vote_compelling,
      vote_not_compelling: r.vote_not_compelling,
      total_leg_stars,
      compelling_pct: totalVotes > 0 ? Math.round((r.vote_compelling / totalVotes) * 100) : null,
      bracket_score: bracketScore({ vote_compelling: r.vote_compelling, vote_not_compelling: r.vote_not_compelling, total_leg_stars }),
      created_at: r.created_at,
      completed_at: r.completed_at,
      topic_id: r.topic_id,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      starter_username: starter?.username ?? 'unknown',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      starter_role: starter?.role ?? 'person',
      opener_content: opener?.content ?? null,
    }
  })

  scored.sort((a, b) => b.bracket_score - a.bracket_score)

  // Take exactly 8 seeds (pad with lowest if fewer)
  const seedCount = Math.min(scored.length, 8)
  const seeds: BracketRelay[] = scored.slice(0, seedCount).map((r, i) => ({
    ...r,
    seed: i + 1,
  }))

  // If fewer than 8, duplicate lowest-ranked seeds to fill (fallback)
  while (seeds.length < 8 && seeds.length > 0) {
    const clone = { ...seeds[seeds.length - 1], seed: seeds.length + 1 }
    seeds.push(clone)
  }

  if (seeds.length < 2) {
    return NextResponse.json({
      week_label: weekLabel,
      week_start_iso: weekStartIso,
      seeds,
      rounds: [],
      champion: null,
      total_votes: 0,
    } satisfies BracketResponse)
  }

  // ─── Build bracket rounds ─────────────────────────────────────────────────

  const seedMap = new Map(seeds.map((s) => [s.seed, s]))

  // Quarterfinals (4 matchups)
  const qfMatchups: BracketMatchup[] = QF_PAIRS.map(([h, l], i) => {
    const higher = seedMap.get(h) ?? seeds[0]
    const lower = seedMap.get(l) ?? seeds[seeds.length - 1]
    const { winner_seed, status } = getMatchWinner(higher, lower)
    return { match_id: i + 1, higher_seed: higher, lower_seed: lower, winner_seed, status }
  })

  // Semifinal matchups — winners from QF pairs (1v8/4v5 → match, 2v7/3v6 → match)
  function getAdvancer(matchup: BracketMatchup): BracketRelay {
    if (matchup.winner_seed !== null) {
      return matchup.winner_seed === matchup.higher_seed.seed
        ? matchup.higher_seed
        : matchup.lower_seed
    }
    return matchup.higher_seed // leading seed advances by default
  }

  const sf1Higher = getAdvancer(qfMatchups[0])
  const sf1Lower = getAdvancer(qfMatchups[1])
  const sf2Higher = getAdvancer(qfMatchups[2])
  const sf2Lower = getAdvancer(qfMatchups[3])

  const sf1 = getMatchWinner(sf1Higher, sf1Lower)
  const sf2 = getMatchWinner(sf2Higher, sf2Lower)

  const sfMatchups: BracketMatchup[] = [
    { match_id: 5, higher_seed: sf1Higher, lower_seed: sf1Lower, winner_seed: sf1.winner_seed, status: sf1.status },
    { match_id: 6, higher_seed: sf2Higher, lower_seed: sf2Lower, winner_seed: sf2.winner_seed, status: sf2.status },
  ]

  // Final
  const fHigher = getAdvancer(sfMatchups[0])
  const fLower = getAdvancer(sfMatchups[1])
  const final = getMatchWinner(fHigher, fLower)
  const finalMatchup: BracketMatchup = {
    match_id: 7,
    higher_seed: fHigher,
    lower_seed: fLower,
    winner_seed: final.winner_seed,
    status: final.status,
  }

  const champion = final.winner_seed !== null
    ? (final.winner_seed === fHigher.seed ? fHigher : fLower)
    : null

  const rounds: BracketRound[] = [
    { round: 1, label: 'Quarterfinals', matchups: qfMatchups },
    { round: 2, label: 'Semifinals', matchups: sfMatchups },
    { round: 3, label: 'Final', matchups: [finalMatchup] },
  ]

  const total_votes = seeds.reduce(
    (s, r) => s + r.vote_compelling + r.vote_not_compelling,
    0
  )

  return NextResponse.json({
    week_label: weekLabel,
    week_start_iso: weekStartIso,
    seeds,
    rounds,
    champion,
    total_votes,
  } satisfies BracketResponse)
}
