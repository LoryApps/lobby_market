import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TwinProfile {
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
}

export interface TwinsResponse {
  twins: TwinProfile[]
  my_total_votes: number
  my_username: string
}

// Minimum shared votes required to surface a user as a twin
const MIN_SHARED = 3
// Max twins returned
const TWINS_LIMIT = 20
// Max topics to consider (most recent votes) to keep the query fast
const MY_VOTES_LIMIT = 200

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

  // 2. Fetch this user's most recent votes (capped for performance)
  const { data: myVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MY_VOTES_LIMIT)

  const myVotes = myVotesRaw ?? []
  if (myVotes.length < MIN_SHARED) {
    return NextResponse.json({
      twins: [],
      my_total_votes: myProfile.total_votes ?? myVotes.length,
      my_username: myProfile.username,
    })
  }

  // Build a map: topic_id → side for O(1) lookup
  const myVoteMap = new Map<string, string>()
  for (const v of myVotes) {
    myVoteMap.set(v.topic_id, v.side)
  }
  const topicIds = Array.from(myVoteMap.keys())

  // 3. Fetch all other users' votes on the same topics
  const { data: otherVotesRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('topic_id', topicIds)
    .neq('user_id', user.id)

  const otherVotes = otherVotesRaw ?? []

  // 4. Aggregate agreement stats per other user
  const statsMap = new Map<string, { total: number; agree: number }>()
  for (const v of otherVotes) {
    const mySide = myVoteMap.get(v.topic_id)
    if (!mySide) continue
    const s = statsMap.get(v.user_id) ?? { total: 0, agree: 0 }
    s.total++
    if (v.side === mySide) s.agree++
    statsMap.set(v.user_id, s)
  }

  // Filter to MIN_SHARED and sort by agreement_pct desc, then total desc
  const ranked = Array.from(statsMap.entries())
    .filter(([, s]) => s.total >= MIN_SHARED)
    .sort(([, a], [, b]) => {
      const pctA = a.agree / a.total
      const pctB = b.agree / b.total
      if (Math.abs(pctA - pctB) > 0.001) return pctB - pctA
      return b.total - a.total
    })
    .slice(0, TWINS_LIMIT)

  if (ranked.length === 0) {
    return NextResponse.json({
      twins: [],
      my_total_votes: myProfile.total_votes ?? myVotes.length,
      my_username: myProfile.username,
    })
  }

  const userIds = ranked.map(([uid]) => uid)

  // 5. Fetch profiles for matched users
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
    .in('id', userIds)

  const profileMap = new Map(
    (profilesRaw ?? []).map((p) => [p.id, p])
  )

  const twinsRaw = ranked.map(([uid, s]) => {
    const p = profileMap.get(uid)
    if (!p) return null
    const twin: TwinProfile = {
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
    }
    return twin
  })
  const twins: TwinProfile[] = twinsRaw.filter((t): t is TwinProfile => t !== null)

  return NextResponse.json({
    twins,
    my_total_votes: myProfile.total_votes ?? myVotes.length,
    my_username: myProfile.username,
  })
}
