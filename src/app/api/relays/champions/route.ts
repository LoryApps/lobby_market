import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface RelayChampion {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  // Starter stats
  relays_started: number
  compelling_started: number
  compelling_rate_started: number | null
  // Contributor stats
  legs_contributed: number
  relays_contributed_to: number
  leg_stars_received: number
  // Combined score
  champion_score: number
}

export interface RelayChampionsResponse {
  champions: RelayChampion[]
  total_relays: number
  total_legs: number
}

// ─── GET /api/relays/champions ────────────────────────────────────────────────
// Returns top relay participants ranked by a composite champion score:
//   compelling_started * 3  (rewarding quality relay chains)
//   + legs_contributed      (rewarding participation)
//   + leg_stars_received    (rewarding leg quality)
//
// Minimum threshold: at least 1 relay started OR 2 legs contributed.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 50)
  const tab = searchParams.get('tab') ?? 'overall'  // overall | starters | contributors

  // ─── Starter stats ────────────────────────────────────────────────────────

  const { data: starterRaw } = await supabase
    .from('civic_relays')
    .select('starter_id, status, vote_compelling, vote_not_compelling')

  const starterMap = new Map<string, {
    started: number
    compelling: number
    not_compelling: number
  }>()

  for (const r of starterRaw ?? []) {
    const existing = starterMap.get(r.starter_id) ?? { started: 0, compelling: 0, not_compelling: 0 }
    existing.started++
    if (r.status === 'voted' || r.status === 'complete') {
      existing.compelling += r.vote_compelling ?? 0
      existing.not_compelling += r.vote_not_compelling ?? 0
    }
    starterMap.set(r.starter_id, existing)
  }

  // ─── Contributor stats ────────────────────────────────────────────────────

  const { data: legRaw } = await supabase
    .from('relay_legs')
    .select('author_id, relay_id, upvote_count')

  const contributorMap = new Map<string, {
    legs: number
    relay_ids: Set<string>
    stars: number
  }>()

  for (const l of legRaw ?? []) {
    const existing = contributorMap.get(l.author_id) ?? { legs: 0, relay_ids: new Set(), stars: 0 }
    existing.legs++
    existing.relay_ids.add(l.relay_id)
    existing.stars += l.upvote_count ?? 0
    contributorMap.set(l.author_id, existing)
  }

  // ─── Merge all unique user IDs ────────────────────────────────────────────

  const allUserIds = new Set([
    ...starterMap.keys(),
    ...contributorMap.keys(),
  ])

  // ─── Fetch profiles ───────────────────────────────────────────────────────

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', Array.from(allUserIds))

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // ─── Build champion rows ──────────────────────────────────────────────────

  const champions: RelayChampion[] = []

  for (const userId of allUserIds) {
    const profile = profileMap.get(userId)
    if (!profile) continue

    const s = starterMap.get(userId)
    const c = contributorMap.get(userId)

    const relays_started = s?.started ?? 0
    const compelling_started = s
      ? Math.round((s.compelling / Math.max(1, s.compelling + s.not_compelling)) * relays_started)
      : 0
    const total_voted = s ? s.compelling + s.not_compelling : 0
    const compelling_rate_started = total_voted >= 3
      ? Math.round((s!.compelling / total_voted) * 100)
      : null

    const legs_contributed = c?.legs ?? 0
    const relays_contributed_to = c?.relay_ids.size ?? 0
    const leg_stars_received = c?.stars ?? 0

    // Skip users with minimal participation
    if (relays_started < 1 && legs_contributed < 2) continue

    const champion_score =
      compelling_started * 3 +
      legs_contributed +
      leg_stars_received * 2

    champions.push({
      user_id: userId,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      relays_started,
      compelling_started,
      compelling_rate_started,
      legs_contributed,
      relays_contributed_to,
      leg_stars_received,
      champion_score,
    })
  }

  // ─── Sort by requested tab ────────────────────────────────────────────────

  if (tab === 'starters') {
    champions.sort((a, b) => b.compelling_started - a.compelling_started || b.relays_started - a.relays_started)
  } else if (tab === 'contributors') {
    champions.sort((a, b) => b.leg_stars_received - a.leg_stars_received || b.legs_contributed - a.legs_contributed)
  } else {
    champions.sort((a, b) => b.champion_score - a.champion_score)
  }

  return NextResponse.json({
    champions: champions.slice(0, limit),
    total_relays: starterRaw?.length ?? 0,
    total_legs: legRaw?.length ?? 0,
  } satisfies RelayChampionsResponse)
}
