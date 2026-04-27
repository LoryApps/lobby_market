import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RivalProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  shared_votes: number
  agree_count: number
  disagree_count: number
  agreement_pct: number
  clash_score: number
  flashpoints: Array<{
    topic_id: string
    statement: string
    category: string | null
    my_side: string
    their_side: string
  }>
}

export interface RivalsResponse {
  rivals: RivalProfile[]
  my_total_votes: number
  my_username: string
}

// Must share at least this many votes to qualify as a rival
const MIN_SHARED = 3
// Maximum rivals returned
const RIVALS_LIMIT = 20
// How many of your recent votes to scan
const MY_VOTES_LIMIT = 200
// Must disagree on at least this fraction to be called a rival
const MIN_CLASH_RATE = 0.40
// Max flashpoint topics to surface per rival
const FLASHPOINTS_PER_RIVAL = 3

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch current user's profile
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('username, total_votes')
    .eq('id', user.id)
    .maybeSingle()

  if (!myProfile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // 2. Fetch this user's most recent votes
  const { data: myVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MY_VOTES_LIMIT)

  const myVotes = myVotesRaw ?? []
  if (myVotes.length < MIN_SHARED) {
    return NextResponse.json({
      rivals: [],
      my_total_votes: myProfile.total_votes ?? myVotes.length,
      my_username: myProfile.username,
    })
  }

  // Build topic→side map for O(1) lookup
  const myVoteMap = new Map<string, string>()
  for (const v of myVotes) {
    myVoteMap.set(v.topic_id, v.side)
  }
  const topicIds = Array.from(myVoteMap.keys())

  // 3. Fetch all other users' votes on the same topics (including topic statement for flashpoints)
  const { data: otherVotesRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('topic_id', topicIds)
    .neq('user_id', user.id)

  const otherVotes = otherVotesRaw ?? []

  // 4. Aggregate clash stats per other user
  // Track which topics they clash on for flashpoints
  const statsMap = new Map<string, {
    total: number
    agree: number
    clashTopics: Array<{ topic_id: string; my_side: string; their_side: string }>
  }>()

  for (const v of otherVotes) {
    const mySide = myVoteMap.get(v.topic_id)
    if (!mySide) continue
    const s = statsMap.get(v.user_id) ?? { total: 0, agree: 0, clashTopics: [] }
    s.total++
    if (v.side === mySide) {
      s.agree++
    } else {
      // They voted opposite — record as a flashpoint candidate
      if (s.clashTopics.length < FLASHPOINTS_PER_RIVAL) {
        s.clashTopics.push({ topic_id: v.topic_id, my_side: mySide, their_side: v.side })
      }
    }
    statsMap.set(v.user_id, s)
  }

  // 5. Filter to rivals: at least MIN_SHARED votes and clash rate >= MIN_CLASH_RATE
  // Sort by LOWEST agreement (most disagreement first), then by most shared votes
  const clashRate = (s: { total: number; agree: number }) => 1 - s.agree / s.total

  const ranked = Array.from(statsMap.entries())
    .filter(([, s]) => s.total >= MIN_SHARED && clashRate(s) >= MIN_CLASH_RATE)
    .sort(([, a], [, b]) => {
      const rateA = clashRate(a)
      const rateB = clashRate(b)
      // Primary: highest clash rate (most disagreement) first
      if (Math.abs(rateA - rateB) > 0.001) return rateB - rateA
      // Tiebreak: most shared votes (more data = more reliable)
      return b.total - a.total
    })
    .slice(0, RIVALS_LIMIT)

  if (ranked.length === 0) {
    return NextResponse.json({
      rivals: [],
      my_total_votes: myProfile.total_votes ?? myVotes.length,
      my_username: myProfile.username,
    })
  }

  const userIds = ranked.map(([uid]) => uid)

  // 6. Fetch profiles for rival users
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
    .in('id', userIds)

  const profileMap = new Map(
    (profilesRaw ?? []).map((p) => [p.id, p])
  )

  // 7. Fetch topic statements for flashpoints
  const allFlashpointTopicIds = new Set<string>()
  for (const [, s] of ranked) {
    for (const fp of s.clashTopics) allFlashpointTopicIds.add(fp.topic_id)
  }

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category')
    .in('id', Array.from(allFlashpointTopicIds))

  const topicMap = new Map((topicRows ?? []).map((t) => [t.id, t]))

  // 8. Build final rival profiles
  const rivalsRaw = ranked.map(([uid, s]) => {
    const p = profileMap.get(uid)
    if (!p) return null

    const rate = clashRate(s)
    const clashScore = Math.round(rate * 100)

    const flashpoints = s.clashTopics
      .map((fp) => {
        const topic = topicMap.get(fp.topic_id)
        if (!topic) return null
        return {
          topic_id: fp.topic_id,
          statement: topic.statement,
          category: topic.category,
          my_side: fp.my_side,
          their_side: fp.their_side,
        }
      })
      .filter((fp): fp is NonNullable<typeof fp> => fp !== null)

    const rival: RivalProfile = {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      clout: p.clout,
      reputation_score: p.reputation_score,
      total_votes: p.total_votes,
      shared_votes: s.total,
      agree_count: s.agree,
      disagree_count: s.total - s.agree,
      agreement_pct: Math.round((s.agree / s.total) * 100),
      clash_score: clashScore,
      flashpoints,
    }
    return rival
  })

  const rivals: RivalProfile[] = rivalsRaw.filter((r): r is RivalProfile => r !== null)

  return NextResponse.json({
    rivals,
    my_total_votes: myProfile.total_votes ?? myVotes.length,
    my_username: myProfile.username,
  } satisfies RivalsResponse)
}
