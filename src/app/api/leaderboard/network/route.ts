import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkTier =
  | 'viral'
  | 'influencer'
  | 'connector'
  | 'networker'
  | 'participant'

export interface NetworkLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  followers_count: number
  following_count: number
  coalition_count: number
  is_influencer: boolean
  network_score: number
  reach_estimate: number
  tier: NetworkTier
}

export interface NetworkMyStats {
  followers_count: number
  following_count: number
  coalition_count: number
  network_score: number
  reach_estimate: number
  tier: NetworkTier
  rank: number | null
  percentile: number | null
}

export type NetworkSort = 'score' | 'reach' | 'bridge'

export interface NetworkLeaderboardResponse {
  entries: NetworkLeaderEntry[]
  sort: NetworkSort
  total_citizens: number
  my_stats: NetworkMyStats | null
  platform_avg_followers: number
  generated_at: string
}

// ─── Tier assignment ──────────────────────────────────────────────────────────

function getNetworkTier(score: number): NetworkTier {
  if (score >= 5_000) return 'viral'
  if (score >= 2_000) return 'influencer'
  if (score >= 1_000) return 'connector'
  if (score >= 300)   return 'networker'
  return 'participant'
}

// Network score: followers are the primary signal, with coalition bridging bonus
function calcNetworkScore(
  followers: number,
  isInfluencer: boolean,
  coalitionCount: number,
): number {
  return (
    followers * 10 +
    (isInfluencer ? 500 : 0) +
    coalitionCount * 30
  )
}

function calcReach(followers: number, following: number): number {
  // Estimated 2nd-degree reach: followers + a fraction of their followers
  // Assumes average user has ~half your follower count in their network
  return Math.round(followers + followers * Math.log10(Math.max(following, 1) + 1))
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sort = (searchParams.get('sort') ?? 'score') as NetworkSort

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Fetch profiles with social metrics ─────────────────────────────────
  const { data: profileRows, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, followers_count, following_count, is_influencer')
    .gt('followers_count', 0)
    .order('followers_count', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const profiles = profileRows ?? []

  // ── 2. Get coalition memberships per user ─────────────────────────────────
  const userIds = profiles.map((p) => p.id)

  const { data: memberRows } = await supabase
    .from('coalition_members')
    .select('user_id')
    .in('user_id', userIds)

  const coalitionMap = new Map<string, number>()
  for (const m of (memberRows ?? [])) {
    coalitionMap.set(m.user_id, (coalitionMap.get(m.user_id) ?? 0) + 1)
  }

  // ── 3. Build entries with scores ──────────────────────────────────────────
  const scored = profiles.map((p) => {
    const followers = p.followers_count ?? 0
    const following = p.following_count ?? 0
    const coalitions = coalitionMap.get(p.id) ?? 0
    const isInfluencer = p.is_influencer ?? false

    const network_score = calcNetworkScore(followers, isInfluencer, coalitions)
    const reach_estimate = calcReach(followers, following)

    return {
      user_id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role ?? 'person',
      clout: p.clout ?? 0,
      followers_count: followers,
      following_count: following,
      coalition_count: coalitions,
      is_influencer: isInfluencer,
      network_score,
      reach_estimate,
      tier: getNetworkTier(network_score),
    }
  })

  // ── 4. Sort by selected mode ──────────────────────────────────────────────
  const sorted = [...scored].sort((a, b) => {
    if (sort === 'reach') return b.reach_estimate - a.reach_estimate
    if (sort === 'bridge') return b.coalition_count - a.coalition_count || b.network_score - a.network_score
    return b.network_score - a.network_score
  })

  const entries: NetworkLeaderEntry[] = sorted.slice(0, 100).map((e, i) => ({
    rank: i + 1,
    ...e,
  }))

  // ── 5. Platform stats ─────────────────────────────────────────────────────
  const { count: totalCitizens } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gt('followers_count', 0)

  const avgFollowers = profiles.length > 0
    ? Math.round(profiles.reduce((s, p) => s + (p.followers_count ?? 0), 0) / profiles.length)
    : 0

  // ── 6. Personal stats ─────────────────────────────────────────────────────
  let my_stats: NetworkMyStats | null = null

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('followers_count, following_count, is_influencer')
      .eq('id', user.id)
      .maybeSingle()

    if (myProfile) {
      const myFollowers = myProfile.followers_count ?? 0
      const myFollowing = myProfile.following_count ?? 0
      const myCoalitions = coalitionMap.get(user.id) ?? 0
      const myInfluencer = myProfile.is_influencer ?? false

      const myNetworkScore = calcNetworkScore(myFollowers, myInfluencer, myCoalitions)
      const myReach = calcReach(myFollowers, myFollowing)

      // Rank among visible entries
      const myRankInList = entries.findIndex((e) => e.user_id === user.id)
      const myRank = myRankInList >= 0 ? myRankInList + 1 : null

      const total = totalCitizens ?? 1
      const percentile = myRank && total > 1
        ? Math.round(((total - myRank) / (total - 1)) * 100)
        : null

      my_stats = {
        followers_count: myFollowers,
        following_count: myFollowing,
        coalition_count: myCoalitions,
        network_score: myNetworkScore,
        reach_estimate: myReach,
        tier: getNetworkTier(myNetworkScore),
        rank: myRank,
        percentile,
      }
    }
  }

  return NextResponse.json({
    entries,
    sort,
    total_citizens: totalCitizens ?? 0,
    my_stats,
    platform_avg_followers: avgFollowers,
    generated_at: new Date().toISOString(),
  } satisfies NetworkLeaderboardResponse)
}
