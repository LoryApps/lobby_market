import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  network_votes: number
  network_for_pct: number
  network_against_pct: number
  my_side: 'blue' | 'red' | null
  agrees_with_network: boolean | null
}

export interface ActiveFollower {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  votes_30d: number
  args_30d: number
  activity_score: number
}

export interface NetworkAgreement {
  topic_id: string
  statement: string
  category: string | null
  my_side: 'blue' | 'red'
  network_for_pct: number
  agrees: boolean
  network_votes: number
}

export interface FollowingAnalyticsResponse {
  following_count: number
  network_votes_30d: number
  network_args_30d: number
  agreement_rate: number | null
  overlapping_topics: number
  hot_topics: NetworkTopic[]
  most_active: ActiveFollower[]
  agreements: NetworkAgreement[]
  disagreements: NetworkAgreement[]
  generatedAt: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Get who I follow
  const { data: followRows } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .limit(500)

  const followingIds = (followRows ?? []).map((r) => r.following_id)
  const followingCount = followingIds.length

  if (followingCount === 0) {
    return NextResponse.json({
      following_count: 0,
      network_votes_30d: 0,
      network_args_30d: 0,
      agreement_rate: null,
      overlapping_topics: 0,
      hot_topics: [],
      most_active: [],
      agreements: [],
      disagreements: [],
      generatedAt: new Date().toISOString(),
    } satisfies FollowingAnalyticsResponse)
  }

  // 2. Network votes in the last 30 days
  const { data: networkVoteRows } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('user_id', followingIds)
    .gte('created_at', since)
    .limit(5000)

  const networkVotes = networkVoteRows ?? []

  // 3. Network arguments in the last 30 days
  const { data: networkArgRows } = await supabase
    .from('topic_arguments')
    .select('user_id, topic_id')
    .in('user_id', followingIds)
    .gte('created_at', since)
    .limit(2000)

  const networkArgs = networkArgRows ?? []

  // 4. My own votes on those topics (for agreement calculation)
  const networkTopicIds = Array.from(new Set(networkVotes.map((v) => v.topic_id)))

  let myVotes: { topic_id: string; side: string }[] = []
  if (networkTopicIds.length > 0) {
    const { data: myVoteRows } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', networkTopicIds)
      .limit(1000)
    myVotes = myVoteRows ?? []
  }

  const myVoteMap = new Map<string, 'blue' | 'red'>(
    myVotes.map((v) => [v.topic_id, v.side as 'blue' | 'red'])
  )

  // 5. Aggregate per-topic network activity
  type TopicStats = { for: number; against: number; voters: Set<string> }
  const topicMap = new Map<string, TopicStats>()

  for (const v of networkVotes) {
    const existing = topicMap.get(v.topic_id) ?? { for: 0, against: 0, voters: new Set() }
    if (v.side === 'blue') existing.for++
    else existing.against++
    existing.voters.add(v.user_id)
    topicMap.set(v.topic_id, existing)
  }

  // 6. Top 8 topics by network activity
  const topTopicIds = Array.from(topicMap.entries())
    .sort((a, b) => (b[1].for + b[1].against) - (a[1].for + a[1].against))
    .slice(0, 8)
    .map(([id]) => id)

  let topicMeta: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }[] = []
  if (topTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topTopicIds)
    topicMeta = topicRows ?? []
  }

  const hot_topics: NetworkTopic[] = topicMeta.map((t) => {
    const stats = topicMap.get(t.id) ?? { for: 0, against: 0, voters: new Set() }
    const total = stats.for + stats.against
    const networkForPct = total > 0 ? Math.round((stats.for / total) * 100) : 50
    const mySide = myVoteMap.get(t.id) ?? null
    const agreesWithNetwork = mySide
      ? (mySide === 'blue' && networkForPct >= 50) || (mySide === 'red' && networkForPct < 50)
      : null

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: Math.round(t.blue_pct ?? 50),
      total_votes: t.total_votes,
      network_votes: total,
      network_for_pct: networkForPct,
      network_against_pct: 100 - networkForPct,
      my_side: mySide,
      agrees_with_network: agreesWithNetwork,
    }
  })

  // 7. Per-follower activity stats
  const followerVotes = new Map<string, number>()
  for (const v of networkVotes) {
    followerVotes.set(v.user_id, (followerVotes.get(v.user_id) ?? 0) + 1)
  }
  const followerArgs = new Map<string, number>()
  for (const a of networkArgs) {
    followerArgs.set(a.user_id, (followerArgs.get(a.user_id) ?? 0) + 1)
  }

  // Top 6 most active followers
  const activeFollowerIds = Array.from(
    new Set([...followerVotes.keys(), ...followerArgs.keys()])
  )
    .map((id) => ({
      id,
      votes: followerVotes.get(id) ?? 0,
      args: followerArgs.get(id) ?? 0,
      score: (followerVotes.get(id) ?? 0) * 1 + (followerArgs.get(id) ?? 0) * 3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  let followerProfiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number }[] = []
  if (activeFollowerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', activeFollowerIds.map((f) => f.id))
    followerProfiles = profileRows ?? []
  }

  const profileMap = new Map(followerProfiles.map((p) => [p.id, p]))

  const most_active: ActiveFollower[] = activeFollowerIds
    .map((f) => {
      const p = profileMap.get(f.id)
      if (!p) return null
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        clout: p.clout,
        votes_30d: f.votes,
        args_30d: f.args,
        activity_score: f.score,
      }
    })
    .filter((f): f is ActiveFollower => f !== null)

  // 8. Agreement / disagreement calculation
  const overlappingTopics = myVotes.filter((v) => topicMap.has(v.topic_id))
  const overlappingCount = overlappingTopics.length

  let agreementCount = 0
  const agreementDetails: NetworkAgreement[] = []
  const disagreementDetails: NetworkAgreement[] = []

  for (const myVote of overlappingTopics) {
    const stats = topicMap.get(myVote.topic_id)
    if (!stats) continue
    const total = stats.for + stats.against
    if (total === 0) continue
    const networkForPct = Math.round((stats.for / total) * 100)
    const networkLeanFor = networkForPct >= 50
    const iAgreeWithFor = myVote.side === 'blue'
    const agrees = iAgreeWithFor === networkLeanFor

    if (agrees) agreementCount++

    // Find topic statement
    const topicData = topicMeta.find((t) => t.id === myVote.topic_id)
    if (!topicData) continue

    const record: NetworkAgreement = {
      topic_id: myVote.topic_id,
      statement: topicData.statement,
      category: topicData.category,
      my_side: myVote.side as 'blue' | 'red',
      network_for_pct: networkForPct,
      agrees,
      network_votes: total,
    }

    if (agrees) agreementDetails.push(record)
    else disagreementDetails.push(record)
  }

  // Sort agreements by network votes (most discussed first)
  agreementDetails.sort((a, b) => b.network_votes - a.network_votes)
  disagreementDetails.sort((a, b) => b.network_votes - a.network_votes)

  const agreementRate =
    overlappingCount > 0 ? Math.round((agreementCount / overlappingCount) * 100) : null

  return NextResponse.json({
    following_count: followingCount,
    network_votes_30d: networkVotes.length,
    network_args_30d: networkArgs.length,
    agreement_rate: agreementRate,
    overlapping_topics: overlappingCount,
    hot_topics,
    most_active,
    agreements: agreementDetails.slice(0, 5),
    disagreements: disagreementDetails.slice(0, 5),
    generatedAt: new Date().toISOString(),
  } satisfies FollowingAnalyticsResponse)
}
