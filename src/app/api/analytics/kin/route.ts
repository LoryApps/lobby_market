import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Minimum shared topics required to count as a match.
const MIN_COMMON = 3
// How many kin / opposites to return.
const TOP_KIN = 5
const TOP_OPPONENTS = 3
// Cap how many of your votes we inspect (keeps query time bounded).
const MY_VOTE_LIMIT = 300
// Cap how many other-user votes we fetch across those topics.
const OTHER_VOTE_LIMIT = 8000

export interface KinProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  agreement_pct: number
  common_topics: number
}

export interface KinResponse {
  kin: KinProfile[]
  opposites: KinProfile[]
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch the current user's recent votes.
  const { data: myVoteRows, error: myVoteErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MY_VOTE_LIMIT)

  if (myVoteErr || !myVoteRows || myVoteRows.length === 0) {
    return NextResponse.json({ kin: [], opposites: [] } satisfies KinResponse)
  }

  // Build a map: topicId → side for O(1) lookup.
  const myVoteMap = new Map<string, string>(
    myVoteRows.map((v) => [v.topic_id, v.side])
  )
  const myTopicIds = Array.from(myVoteMap.keys())

  // 2. Fetch other users' votes on those same topics.
  const { data: otherVoteRows, error: otherVoteErr } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('topic_id', myTopicIds)
    .neq('user_id', user.id)
    .limit(OTHER_VOTE_LIMIT)

  if (otherVoteErr || !otherVoteRows || otherVoteRows.length === 0) {
    return NextResponse.json({ kin: [], opposites: [] } satisfies KinResponse)
  }

  // 3. Compute per-user agreement stats.
  const userStats = new Map<string, { common: number; agree: number }>()
  for (const vote of otherVoteRows) {
    const mySide = myVoteMap.get(vote.topic_id)
    if (!mySide) continue
    const existing = userStats.get(vote.user_id) ?? { common: 0, agree: 0 }
    existing.common++
    if (vote.side === mySide) existing.agree++
    userStats.set(vote.user_id, existing)
  }

  // 4. Filter by minimum overlap and compute similarity scores.
  type RankedUser = { userId: string; agreementPct: number; common: number }

  const ranked: RankedUser[] = Array.from(userStats.entries())
    .filter(([, stats]) => stats.common >= MIN_COMMON)
    .map(([userId, stats]) => ({
      userId,
      agreementPct: Math.round((stats.agree / stats.common) * 100),
      common: stats.common,
    }))

  if (ranked.length === 0) {
    return NextResponse.json({ kin: [], opposites: [] } satisfies KinResponse)
  }

  // Sort descending for kin, ascending for opposites.
  ranked.sort((a, b) => b.agreementPct - a.agreementPct)

  const kinIds = ranked.slice(0, TOP_KIN).map((r) => r.userId)
  const oppositeIds = ranked.slice(-TOP_OPPONENTS).map((r) => r.userId)
  const allIds = Array.from(new Set([...kinIds, ...oppositeIds]))

  // 5. Fetch profile data for matched users.
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, reputation_score')
    .in('id', allIds)

  if (profileErr || !profiles) {
    return NextResponse.json({ kin: [], opposites: [] } satisfies KinResponse)
  }

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    reputation_score: number
  }
  const profileMap = new Map<string, ProfileRow>(
    (profiles as ProfileRow[]).map((p) => [p.id, p])
  )

  function buildKinList(ids: string[]): KinProfile[] {
    return ids
      .map((id) => {
        const p = profileMap.get(id)
        const stats = userStats.get(id)
        if (!p || !stats) return null
        return {
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role,
          reputation_score: p.reputation_score,
          agreement_pct: Math.round((stats.agree / stats.common) * 100),
          common_topics: stats.common,
        }
      })
      .filter((k): k is KinProfile => k !== null)
  }

  const kin = buildKinList(kinIds)
  // Opposites: start from end of ranked list (lowest agreement).
  const oppositeRanked = [...ranked].reverse().slice(0, TOP_OPPONENTS)
  const opposites = buildKinList(oppositeRanked.map((r) => r.userId))

  return NextResponse.json({ kin, opposites } satisfies KinResponse)
}
