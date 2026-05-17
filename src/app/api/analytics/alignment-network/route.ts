import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MY_VOTE_LIMIT = 300
const THEIR_VOTE_LIMIT = 6000
const MIN_COMMON = 3

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlignedUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  agreement_pct: number
  common_topics: number
  source: 'following' | 'coalition'
}

export interface AlignmentNetworkResponse {
  following: AlignedUser[]
  coalition: AlignedUser[]
  /** Overall stats */
  stats: {
    avg_following_pct: number | null
    avg_coalition_pct: number | null
    total_following: number
    total_coalition: number
    scored_following: number
    scored_coalition: number
  }
  viewer_has_votes: boolean
}

// ─── GET /api/analytics/alignment-network ─────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch my votes.
  const { data: myVoteRows } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MY_VOTE_LIMIT)

  if (!myVoteRows || myVoteRows.length === 0) {
    return NextResponse.json({
      following: [],
      coalition: [],
      stats: {
        avg_following_pct: null,
        avg_coalition_pct: null,
        total_following: 0,
        total_coalition: 0,
        scored_following: 0,
        scored_coalition: 0,
      },
      viewer_has_votes: false,
    } satisfies AlignmentNetworkResponse)
  }

  const myVoteMap = new Map<string, string>(myVoteRows.map((v) => [v.topic_id, v.side]))
  const myTopicIds = Array.from(myVoteMap.keys())

  // 2. Fetch who I'm following and my coalition members in parallel.
  const [followRes, coalitionMemberRes] = await Promise.all([
    supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .limit(100),
    supabase
      .from('coalition_members')
      .select('coalition_id')
      .eq('user_id', user.id)
      .limit(10),
  ])

  const followingIds = new Set<string>(
    (followRes.data ?? []).map((r: { following_id: string }) => r.following_id)
  )

  // Get coalition member IDs (excluding myself) from my coalitions.
  let coalitionOnlyIds = new Set<string>()
  const myCoalitionIds = (coalitionMemberRes.data ?? []).map(
    (r: { coalition_id: string }) => r.coalition_id
  )

  if (myCoalitionIds.length > 0) {
    const { data: coMemberRows } = await supabase
      .from('coalition_members')
      .select('user_id')
      .in('coalition_id', myCoalitionIds)
      .neq('user_id', user.id)
      .limit(200)

    coalitionOnlyIds = new Set<string>(
      (coMemberRows ?? []).map((r: { user_id: string }) => r.user_id)
    )
  }

  // All target user IDs we need to compute alignment for.
  const allTargetIds = Array.from(new Set([...followingIds, ...coalitionOnlyIds]))

  if (allTargetIds.length === 0) {
    return NextResponse.json({
      following: [],
      coalition: [],
      stats: {
        avg_following_pct: null,
        avg_coalition_pct: null,
        total_following: followingIds.size,
        total_coalition: coalitionOnlyIds.size,
        scored_following: 0,
        scored_coalition: 0,
      },
      viewer_has_votes: true,
    } satisfies AlignmentNetworkResponse)
  }

  // 3. Fetch their votes on my topics.
  const { data: otherVoteRows } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('topic_id', myTopicIds)
    .in('user_id', allTargetIds)
    .limit(THEIR_VOTE_LIMIT)

  // 4. Compute per-user agreement stats.
  const userStats = new Map<string, { common: number; agree: number }>()
  for (const vote of otherVoteRows ?? []) {
    const mySide = myVoteMap.get(vote.topic_id)
    if (!mySide) continue
    const existing = userStats.get(vote.user_id) ?? { common: 0, agree: 0 }
    existing.common++
    if (vote.side === mySide) existing.agree++
    userStats.set(vote.user_id, existing)
  }

  // 5. Build scored user list.
  const scoredIds = allTargetIds.filter((id) => {
    const s = userStats.get(id)
    return s && s.common >= MIN_COMMON
  })

  if (scoredIds.length === 0) {
    return NextResponse.json({
      following: [],
      coalition: [],
      stats: {
        avg_following_pct: null,
        avg_coalition_pct: null,
        total_following: followingIds.size,
        total_coalition: coalitionOnlyIds.size,
        scored_following: 0,
        scored_coalition: 0,
      },
      viewer_has_votes: true,
    } satisfies AlignmentNetworkResponse)
  }

  // 6. Fetch profiles for scored users.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', scoredIds)

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  const profileMap = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])
  )

  function buildAlignedUser(id: string, source: AlignedUser['source']): AlignedUser | null {
    const p = profileMap.get(id)
    const s = userStats.get(id)
    if (!p || !s || s.common < MIN_COMMON) return null
    return {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      agreement_pct: Math.round((s.agree / s.common) * 100),
      common_topics: s.common,
      source,
    }
  }

  const followingList: AlignedUser[] = Array.from(followingIds)
    .map((id) => buildAlignedUser(id, 'following'))
    .filter((u): u is AlignedUser => u !== null)
    .sort((a, b) => b.agreement_pct - a.agreement_pct)

  // Coalition: include only users NOT already in the following list for de-duplication,
  // but tag them with 'coalition' source.
  const coalitionList: AlignedUser[] = Array.from(coalitionOnlyIds)
    .filter((id) => !followingIds.has(id))
    .map((id) => buildAlignedUser(id, 'coalition'))
    .filter((u): u is AlignedUser => u !== null)
    .sort((a, b) => b.agreement_pct - a.agreement_pct)

  function avg(list: AlignedUser[]): number | null {
    if (list.length === 0) return null
    return Math.round(list.reduce((s, u) => s + u.agreement_pct, 0) / list.length)
  }

  return NextResponse.json({
    following: followingList,
    coalition: coalitionList,
    stats: {
      avg_following_pct: avg(followingList),
      avg_coalition_pct: avg(coalitionList),
      total_following: followingIds.size,
      total_coalition: coalitionOnlyIds.size,
      scored_following: followingList.length,
      scored_coalition: coalitionList.length,
    },
    viewer_has_votes: true,
  } satisfies AlignmentNetworkResponse)
}
