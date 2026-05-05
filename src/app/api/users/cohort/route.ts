import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface AllyProfile {
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
  bond_score: number
  bond_topics: Array<{
    topic_id: string
    statement: string
    category: string | null
    shared_side: string
  }>
  top_shared_category: string | null
}

export interface CohortResponse {
  allies: AllyProfile[]
  my_total_votes: number
  my_username: string
}

const MIN_SHARED = 3
const ALLIES_LIMIT = 20
const MY_VOTES_LIMIT = 200
const MIN_AGREE_RATE = 0.60
const BOND_TOPICS_PER_ALLY = 3

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('username, total_votes')
    .eq('id', user.id)
    .maybeSingle()

  if (!myProfile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: myVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MY_VOTES_LIMIT)

  const myVotes = myVotesRaw ?? []
  if (myVotes.length < MIN_SHARED) {
    return NextResponse.json({
      allies: [],
      my_total_votes: myProfile.total_votes ?? myVotes.length,
      my_username: myProfile.username,
    } satisfies CohortResponse)
  }

  const myVoteMap = new Map<string, string>()
  for (const v of myVotes) {
    myVoteMap.set(v.topic_id, v.side)
  }
  const topicIds = Array.from(myVoteMap.keys())

  const { data: otherVotesRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('topic_id', topicIds)
    .neq('user_id', user.id)

  const otherVotes = otherVotesRaw ?? []

  const statsMap = new Map<string, {
    total: number
    agree: number
    bondTopics: Array<{ topic_id: string; shared_side: string }>
    categoryCounts: Record<string, number>
  }>()

  for (const v of otherVotes) {
    const mySide = myVoteMap.get(v.topic_id)
    if (!mySide) continue
    const s = statsMap.get(v.user_id) ?? {
      total: 0,
      agree: 0,
      bondTopics: [],
      categoryCounts: {},
    }
    s.total++
    if (v.side === mySide) {
      s.agree++
      if (s.bondTopics.length < BOND_TOPICS_PER_ALLY) {
        s.bondTopics.push({ topic_id: v.topic_id, shared_side: mySide })
      }
    }
    statsMap.set(v.user_id, s)
  }

  const agreeRate = (s: { total: number; agree: number }) => s.agree / s.total

  const ranked = Array.from(statsMap.entries())
    .filter(([, s]) => s.total >= MIN_SHARED && agreeRate(s) >= MIN_AGREE_RATE)
    .sort(([, a], [, b]) => {
      const rateA = agreeRate(a)
      const rateB = agreeRate(b)
      if (Math.abs(rateA - rateB) > 0.001) return rateB - rateA
      return b.total - a.total
    })
    .slice(0, ALLIES_LIMIT)

  if (ranked.length === 0) {
    return NextResponse.json({
      allies: [],
      my_total_votes: myProfile.total_votes ?? myVotes.length,
      my_username: myProfile.username,
    } satisfies CohortResponse)
  }

  const userIds = ranked.map(([uid]) => uid)

  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
    .in('id', userIds)

  const profileMap = new Map(
    (profilesRaw ?? []).map((p) => [p.id, p])
  )

  const allBondTopicIds = new Set<string>()
  for (const [, s] of ranked) {
    for (const bt of s.bondTopics) allBondTopicIds.add(bt.topic_id)
  }

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category')
    .in('id', Array.from(allBondTopicIds))

  const topicMap = new Map((topicRows ?? []).map((t) => [t.id, t]))

  const allies: AllyProfile[] = ranked
    .map(([uid, s]) => {
      const p = profileMap.get(uid)
      if (!p) return null

      const bondTopics = s.bondTopics
        .map((bt) => {
          const topic = topicMap.get(bt.topic_id)
          if (!topic) return null
          return {
            topic_id: bt.topic_id,
            statement: topic.statement,
            category: topic.category,
            shared_side: bt.shared_side,
          }
        })
        .filter((bt): bt is NonNullable<typeof bt> => bt !== null)

      // Find most common shared category
      const catCounts: Record<string, number> = {}
      for (const bt of bondTopics) {
        if (bt.category) catCounts[bt.category] = (catCounts[bt.category] ?? 0) + 1
      }
      const topCat = Object.entries(catCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

      const ally: AllyProfile = {
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
        bond_score: Math.round(agreeRate(s) * 100),
        bond_topics: bondTopics,
        top_shared_category: topCat,
      }
      return ally
    })
    .filter((a): a is AllyProfile => a !== null)

  return NextResponse.json({
    allies,
    my_total_votes: myProfile.total_votes ?? myVotes.length,
    my_username: myProfile.username,
  } satisfies CohortResponse)
}
