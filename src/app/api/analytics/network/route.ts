import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Constants ────────────────────────────────────────────────────────────────

const MY_VOTE_LIMIT = 300
const NETWORK_VOTE_LIMIT = 6000

// ── Types ────────────────────────────────────────────────────────────────────

export interface NetworkMember {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  agreement_pct: number | null
  common_topics: number
  follower_count: number
  is_bridge: boolean
}

export interface CategoryDiversity {
  category: string
  my_pct_for: number
  network_avg_pct_for: number
  divergence: number
}

export interface NetworkAnalyticsResponse {
  // Graph size
  following_count: number
  followers_count: number
  second_degree_reach: number

  // Echo chamber
  echo_chamber_score: number       // 0–100: 100 = total echo chamber
  agreement_rate: number           // 0–100: % of votes that match network avg
  overlapping_topics: number

  // Diversity
  diversity_index: number          // 0–100: 100 = maximally diverse
  category_diversity: CategoryDiversity[]

  // Bridge
  bridge_score: number             // 0–100: how much you bridge communities
  top_bridge_members: NetworkMember[]

  // Network members summary
  top_members: NetworkMember[]

  // Suggested follows for diversity
  diversity_suggestions: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    agreement_pct: number
    common_topics: number
    why: string
  }[]

  generatedAt: string
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Get follows / followers ────────────────────────────────────────────

  const [followingRes, followersRes] = await Promise.all([
    supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id),
    supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', user.id),
  ])

  const followingIds = (followingRes.data ?? []).map((r) => r.following_id)
  const followerIds = (followersRes.data ?? []).map((r) => r.follower_id)
  const networkIds = Array.from(new Set([...followingIds, ...followerIds]))

  if (networkIds.length === 0) {
    return NextResponse.json({
      following_count: 0,
      followers_count: 0,
      second_degree_reach: 0,
      echo_chamber_score: 0,
      agreement_rate: 0,
      overlapping_topics: 0,
      diversity_index: 0,
      category_diversity: [],
      bridge_score: 0,
      top_bridge_members: [],
      top_members: [],
      diversity_suggestions: [],
      generatedAt: new Date().toISOString(),
    } satisfies NetworkAnalyticsResponse)
  }

  // ── 2. Fetch member profiles ──────────────────────────────────────────────

  const { data: memberProfiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', networkIds)
    .limit(200)

  const profileMap = new Map<string, (typeof memberProfiles extends Array<infer T> ? T : never)>(
    (memberProfiles ?? []).map((p) => [p.id, p])
  )

  // ── 3. Fetch 2nd-degree size (followers of people you follow) ────────────

  let secondDegreeReach = 0
  if (followingIds.length > 0) {
    const { count } = await supabase
      .from('user_follows')
      .select('follower_id', { count: 'exact', head: true })
      .in('following_id', followingIds.slice(0, 50))
      .not('follower_id', 'in', `(${[user.id, ...followingIds].join(',')})`)

    secondDegreeReach = count ?? 0
  }

  // ── 4. Fetch my votes ────────────────────────────────────────────────────

  const { data: myVoteRows } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MY_VOTE_LIMIT)

  const myVoteMap = new Map<string, string>(
    (myVoteRows ?? []).map((v) => [v.topic_id, v.side])
  )
  const myTopicIds = Array.from(myVoteMap.keys())

  // ── 5. Fetch network votes on same topics ────────────────────────────────

  type NetworkVoteRow = { user_id: string; topic_id: string; side: string }
  let networkVoteRows: NetworkVoteRow[] = []

  if (myTopicIds.length > 0 && networkIds.length > 0) {
    const { data } = await supabase
      .from('votes')
      .select('user_id, topic_id, side')
      .in('topic_id', myTopicIds)
      .in('user_id', networkIds)
      .limit(NETWORK_VOTE_LIMIT)
    networkVoteRows = (data ?? []) as NetworkVoteRow[]
  }

  // ── 6. Per-member agreement stats ────────────────────────────────────────

  const memberStats = new Map<string, { common: number; agree: number }>()
  const topicNetworkVotes = new Map<string, { forCount: number; totalCount: number }>()

  for (const vote of networkVoteRows) {
    const mySide = myVoteMap.get(vote.topic_id)
    if (!mySide) continue

    // Per-member agreement
    const m = memberStats.get(vote.user_id) ?? { common: 0, agree: 0 }
    m.common++
    if (vote.side === mySide) m.agree++
    memberStats.set(vote.user_id, m)

    // Aggregate topic-level FOR pct across network
    const t = topicNetworkVotes.get(vote.topic_id) ?? { forCount: 0, totalCount: 0 }
    t.totalCount++
    if (vote.side === 'blue') t.forCount++
    topicNetworkVotes.set(vote.topic_id, t)
  }

  // ── 7. Echo chamber score ────────────────────────────────────────────────
  // = average per-topic: did I vote with the network majority?

  let agreedTopics = 0
  const overlappingTopics = topicNetworkVotes.size

  for (const [topicId, { forCount, totalCount }] of topicNetworkVotes) {
    const networkForPct = forCount / totalCount
    const networkMajority = networkForPct >= 0.5 ? 'blue' : 'red'
    const myVote = myVoteMap.get(topicId)
    if (myVote === networkMajority) agreedTopics++
  }

  const agreementRate =
    overlappingTopics > 0 ? Math.round((agreedTopics / overlappingTopics) * 100) : 0

  // Echo chamber = how much you agree (100 = full echo chamber)
  const echoChamberScore = agreementRate

  // ── 8. Category diversity ────────────────────────────────────────────────

  // Fetch topic categories for my voted topics
  type TopicRow = { id: string; category: string | null; blue_pct: number }
  let topicRows: TopicRow[] = []
  if (myTopicIds.length > 0) {
    const { data } = await supabase
      .from('topics')
      .select('id, category, blue_pct')
      .in('id', myTopicIds)
    topicRows = (data ?? []) as TopicRow[]
  }

  const topicCategoryMap = new Map<string, string>(
    topicRows.filter((t) => t.category).map((t) => [t.id, t.category!])
  )

  // Group my votes by category
  const myVotesByCategory = new Map<string, { forCount: number; total: number }>()
  for (const [topicId, side] of myVoteMap) {
    const cat = topicCategoryMap.get(topicId)
    if (!cat) continue
    const c = myVotesByCategory.get(cat) ?? { forCount: 0, total: 0 }
    c.total++
    if (side === 'blue') c.forCount++
    myVotesByCategory.set(cat, c)
  }

  // Group network votes by category
  const networkVotesByCategory = new Map<string, { forCount: number; total: number }>()
  for (const vote of networkVoteRows) {
    const cat = topicCategoryMap.get(vote.topic_id)
    if (!cat) continue
    const c = networkVotesByCategory.get(cat) ?? { forCount: 0, total: 0 }
    c.total++
    if (vote.side === 'blue') c.forCount++
    networkVotesByCategory.set(cat, c)
  }

  const categoryDiversity: CategoryDiversity[] = []
  for (const [cat, myStats] of myVotesByCategory) {
    if (myStats.total < 2) continue
    const netStats = networkVotesByCategory.get(cat)
    const myPctFor = Math.round((myStats.forCount / myStats.total) * 100)
    const networkAvgPctFor = netStats
      ? Math.round((netStats.forCount / netStats.total) * 100)
      : myPctFor
    const divergence = Math.abs(myPctFor - networkAvgPctFor)
    categoryDiversity.push({ category: cat, my_pct_for: myPctFor, network_avg_pct_for: networkAvgPctFor, divergence })
  }
  categoryDiversity.sort((a, b) => b.divergence - a.divergence)

  // Diversity index = average divergence across categories (0 = full echo, 100 = max diverse)
  const diversityIndex =
    categoryDiversity.length > 0
      ? Math.min(
          100,
          Math.round(
            categoryDiversity.reduce((s, c) => s + c.divergence, 0) / categoryDiversity.length
          )
        )
      : 0

  // ── 9. Bridge score + per-member data ────────────────────────────────────
  // Bridge = you follow people with low agreement to you (they think differently)
  // but they are themselves influential (high clout / many followers)

  const memberList: NetworkMember[] = []
  for (const id of networkIds) {
    const profile = profileMap.get(id)
    if (!profile) continue
    const stats = memberStats.get(id)
    const agreementPct =
      stats && stats.common >= 3 ? Math.round((stats.agree / stats.common) * 100) : null
    // "bridge" users are those where you disagree more than average
    const isBridge = agreementPct !== null && agreementPct < 45
    memberList.push({
      id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout ?? 0,
      agreement_pct: agreementPct,
      common_topics: stats?.common ?? 0,
      follower_count: 0, // simplified
      is_bridge: isBridge,
    })
  }

  const bridgeMembers = memberList
    .filter((m) => m.is_bridge)
    .sort((a, b) => b.clout - a.clout)
    .slice(0, 5)

  // Bridge score = pct of network members who are "bridges"
  const bridgeScore =
    memberList.length > 0
      ? Math.min(100, Math.round((bridgeMembers.length / memberList.length) * 100) * 3)
      : 0

  const topMembers = memberList
    .sort((a, b) => b.clout - a.clout)
    .slice(0, 8)

  // ── 10. Diversity suggestions ─────────────────────────────────────────────
  // Find high-clout users the current user doesn't follow who have low vote agreement

  let diversitySuggestions: NetworkAnalyticsResponse['diversity_suggestions'] = []

  if (myTopicIds.length >= 5) {
    // Get top users by clout who are NOT in the current network
    const { data: candidateProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .not('id', 'in', `(${[user.id, ...networkIds].join(',')})`)
      .order('clout', { ascending: false })
      .limit(100)

    if (candidateProfiles && candidateProfiles.length > 0) {
      const candidateIds = candidateProfiles.map((p) => p.id)
      const { data: candidateVotes } = await supabase
        .from('votes')
        .select('user_id, topic_id, side')
        .in('topic_id', myTopicIds)
        .in('user_id', candidateIds)
        .limit(3000)

      // Compute agreement with each candidate
      const candidateStats = new Map<string, { common: number; agree: number }>()
      for (const vote of candidateVotes ?? []) {
        const mySide = myVoteMap.get(vote.topic_id)
        if (!mySide) continue
        const s = candidateStats.get(vote.user_id) ?? { common: 0, agree: 0 }
        s.common++
        if (vote.side === mySide) s.agree++
        candidateStats.set(vote.user_id, s)
      }

      diversitySuggestions = candidateProfiles
        .filter((p) => {
          const s = candidateStats.get(p.id)
          return s && s.common >= 3
        })
        .map((p) => {
          const s = candidateStats.get(p.id)!
          const agreementPct = Math.round((s.agree / s.common) * 100)
          const why =
            agreementPct < 35
              ? 'Challenges your views often'
              : agreementPct < 50
              ? 'Votes differently on key topics'
              : agreementPct < 65
              ? 'Balanced perspective'
              : 'Often votes like you'
          return { ...p, clout: p.clout ?? 0, agreement_pct: agreementPct, common_topics: s.common, why }
        })
        .sort((a, b) => {
          // Prefer users with moderate disagreement (35-55 range) over extreme opposites
          const targetA = Math.abs(a.agreement_pct - 45)
          const targetB = Math.abs(b.agreement_pct - 45)
          return targetA - targetB
        })
        .slice(0, 5)
    }
  }

  return NextResponse.json({
    following_count: followingIds.length,
    followers_count: followerIds.length,
    second_degree_reach: secondDegreeReach,
    echo_chamber_score: echoChamberScore,
    agreement_rate: agreementRate,
    overlapping_topics,
    diversity_index: diversityIndex,
    category_diversity: categoryDiversity.slice(0, 8),
    bridge_score: bridgeScore,
    top_bridge_members: bridgeMembers,
    top_members: topMembers,
    diversity_suggestions: diversitySuggestions,
    generatedAt: new Date().toISOString(),
  } satisfies NetworkAnalyticsResponse)
}
