import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface EchoChamberTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  /** The user's own vote on this topic */
  user_vote: 'blue' | 'red' | null
  /** % of followed users who voted FOR (blue) */
  follow_for_pct: number
  /** % of followed users who voted AGAINST (red) */
  follow_against_pct: number
  /** Total followed users who voted on this topic */
  follow_voters: number
  /** Strength of echo: 0–100 (100 = all follows voted the same way) */
  echo_score: number
  /** Whether user agrees with the majority of their follows */
  user_agrees: boolean
  /** Best contrarian argument (opposite side from follow consensus) */
  contrarian_argument: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    author_username: string | null
    author_display_name: string | null
  } | null
}

export interface EchoChamberUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  /** How often this user disagrees with the viewer on shared voted topics */
  disagreement_rate: number
  shared_topics: number
}

export interface EchoChamberResponse {
  /** 0–100: how diverse is the user's civic feed? Higher = more diverse */
  diversity_score: number
  /** How many topics where follows all vote the same way */
  echo_topics_count: number
  /** How many people the user follows */
  following_count: number
  /** Topics trapped in echo chambers */
  echo_topics: EchoChamberTopic[]
  /** Suggested diverse follows */
  diverse_follows: EchoChamberUser[]
}

const ECHO_THRESHOLD = 0.75 // 75%+ of follows on one side = echo chamber
const MAX_ECHO_TOPICS = 15
const MAX_DIVERSE_FOLLOWS = 8

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the list of people the user follows
  const { data: followsRaw } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .limit(500)

  const followIds = (followsRaw ?? []).map((f) => f.following_id)
  const followingCount = followIds.length

  if (followIds.length === 0) {
    return NextResponse.json({
      diversity_score: 100,
      echo_topics_count: 0,
      following_count: 0,
      echo_topics: [],
      diverse_follows: [],
    } satisfies EchoChamberResponse)
  }

  // Get user's own recent votes (limit to topics where they voted)
  const { data: userVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const userVotedTopicIds = (userVotesRaw ?? []).map((v) => v.topic_id)
  const userVoteMap = new Map<string, 'blue' | 'red'>(
    (userVotesRaw ?? []).map((v) => [v.topic_id, v.side as 'blue' | 'red'])
  )

  if (userVotedTopicIds.length === 0) {
    return NextResponse.json({
      diversity_score: 100,
      echo_topics_count: 0,
      following_count: followingCount,
      echo_topics: [],
      diverse_follows: [],
    } satisfies EchoChamberResponse)
  }

  // Get followed users' votes on the same topics the user has voted on
  const { data: followVotesRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('user_id', followIds)
    .in('topic_id', userVotedTopicIds)

  const followVotes = followVotesRaw ?? []

  // Build per-topic follow vote tallies
  const topicFollowMap = new Map<string, { blue: number; red: number; voters: Set<string> }>()
  for (const vote of followVotes) {
    if (!topicFollowMap.has(vote.topic_id)) {
      topicFollowMap.set(vote.topic_id, { blue: 0, red: 0, voters: new Set() })
    }
    const entry = topicFollowMap.get(vote.topic_id)!
    entry.voters.add(vote.user_id)
    if (vote.side === 'blue') entry.blue++
    else entry.red++
  }

  // Find echo chamber topics (≥ ECHO_THRESHOLD of follows vote same side, ≥ 2 followers voted)
  const echoChamberTopicIds: string[] = []
  Array.from(topicFollowMap.entries()).forEach(([topicId, tally]) => {
    if (tally.voters.size < 2) return
    const total = tally.blue + tally.red
    if (total === 0) return
    const forPct = tally.blue / total
    const againstPct = tally.red / total
    if (forPct >= ECHO_THRESHOLD || againstPct >= ECHO_THRESHOLD) {
      echoChamberTopicIds.push(topicId)
    }
  })

  // Load topic details for echo chamber topics
  const topicsToFetch = echoChamberTopicIds.slice(0, MAX_ECHO_TOPICS)
  let topicsRaw: Array<{
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
    total_votes: number | null
  }> = []
  if (topicsToFetch.length > 0) {
    const { data } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicsToFetch)
      .neq('status', 'failed')
    topicsRaw = data ?? []
  }

  const topicDetailMap = new Map(topicsRaw.map((t) => [t.id, t]))

  // For each echo topic, fetch the best contrarian argument
  const echoTopics: EchoChamberTopic[] = []

  for (const topicId of topicsToFetch) {
    const detail = topicDetailMap.get(topicId)
    if (!detail) continue

    const tally = topicFollowMap.get(topicId)!
    const total = tally.blue + tally.red
    const followForPct = total > 0 ? Math.round((tally.blue / total) * 100) : 50
    const followAgainstPct = 100 - followForPct

    // Echo score: how extreme the consensus is (50% = balanced, 100% = total echo)
    const maxPct = Math.max(followForPct, followAgainstPct)
    const echoScore = Math.round(((maxPct - 50) / 50) * 100)

    // Consensus side among follows
    const followConsensus: 'blue' | 'red' = followForPct >= followAgainstPct ? 'blue' : 'red'
    // Contrarian side is the opposite
    const contrarianSide: 'blue' | 'red' = followConsensus === 'blue' ? 'red' : 'blue'

    const userVote = userVoteMap.get(topicId) ?? null
    const userAgrees = userVote !== null ? userVote === followConsensus : true

    // Fetch best contrarian argument (opposite side from consensus)
    const { data: argRaw } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, user_id')
      .eq('topic_id', topicId)
      .eq('side', contrarianSide)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle()

    let contrarianArg: EchoChamberTopic['contrarian_argument'] = null
    if (argRaw) {
      // Fetch author profile separately
      const { data: authorProfile } = argRaw.user_id
        ? await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('id', argRaw.user_id)
            .maybeSingle()
        : { data: null }

      contrarianArg = {
        id: argRaw.id,
        content: argRaw.content,
        side: argRaw.side as 'blue' | 'red',
        upvotes: argRaw.upvotes ?? 0,
        author_username: authorProfile?.username ?? null,
        author_display_name: authorProfile?.display_name ?? null,
      }
    }

    echoTopics.push({
      id: topicId,
      statement: detail.statement,
      category: detail.category ?? null,
      status: detail.status,
      blue_pct: detail.blue_pct ?? 50,
      total_votes: detail.total_votes ?? 0,
      user_vote: userVote,
      follow_for_pct: followForPct,
      follow_against_pct: followAgainstPct,
      follow_voters: tally.voters.size,
      echo_score: echoScore,
      user_agrees: userAgrees,
      contrarian_argument: contrarianArg,
    })
  }

  // Sort by echo_score descending (most extreme echo chambers first)
  echoTopics.sort((a, b) => b.echo_score - a.echo_score)

  // Diversity score: more echo topics relative to total voted = lower diversity
  const echoRatio = echoChamberTopicIds.length / Math.max(1, userVotedTopicIds.length)
  const rawDiversity = Math.round((1 - echoRatio) * 100)
  const diversityScore = Math.max(0, Math.min(100, rawDiversity))

  // Find diverse follow suggestions: users NOT yet followed who often disagree
  // with the current user on topics they've both voted on
  const { data: candidatesRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('topic_id', userVotedTopicIds.slice(0, 100))
    .not('user_id', 'in', `(${[user.id, ...followIds].join(',')})`)
    .limit(2000)

  // Tally disagreement rates per candidate
  const candidateMap = new Map<string, { disagree: number; total: number }>()
  for (const vote of candidatesRaw ?? []) {
    const userSide = userVoteMap.get(vote.topic_id)
    if (!userSide) continue
    if (!candidateMap.has(vote.user_id)) {
      candidateMap.set(vote.user_id, { disagree: 0, total: 0 })
    }
    const entry = candidateMap.get(vote.user_id)!
    entry.total++
    if (vote.side !== userSide) entry.disagree++
  }

  // Filter: need ≥3 shared topics, ≥40% disagreement rate
  const qualifiedCandidates = Array.from(candidateMap.entries())
    .filter(([, s]) => s.total >= 3 && s.disagree / s.total >= 0.4)
    .sort((a, b) => b[1].disagree / b[1].total - a[1].disagree / a[1].total)
    .slice(0, MAX_DIVERSE_FOLLOWS * 3) // over-fetch to account for profile lookup

  const candidateIds = qualifiedCandidates.map(([id]) => id)

  let diverseFollows: EchoChamberUser[] = []
  if (candidateIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', candidateIds)
      .limit(MAX_DIVERSE_FOLLOWS)

    const profileMap = new Map((profilesRaw ?? []).map((p) => [p.id, p]))

    diverseFollows = qualifiedCandidates
      .slice(0, MAX_DIVERSE_FOLLOWS)
      .map(([id, stats]) => {
        const prof = profileMap.get(id)
        if (!prof) return null
        return {
          id: prof.id,
          username: prof.username,
          display_name: prof.display_name ?? null,
          avatar_url: prof.avatar_url ?? null,
          role: prof.role ?? 'person',
          clout: prof.clout ?? 0,
          disagreement_rate: Math.round((stats.disagree / stats.total) * 100),
          shared_topics: stats.total,
        } satisfies EchoChamberUser
      })
      .filter((u): u is EchoChamberUser => u !== null)
  }

  return NextResponse.json({
    diversity_score: diversityScore,
    echo_topics_count: echoChamberTopicIds.length,
    following_count: followingCount,
    echo_topics: echoTopics,
    diverse_follows: diverseFollows,
  } satisfies EchoChamberResponse)
}
