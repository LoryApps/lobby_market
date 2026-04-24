import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompareProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  bio: string | null
  vote_streak: number
}

export interface SharedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  side_a: 'blue' | 'red'
  side_b: 'blue' | 'red'
  agree: boolean
}

export interface CategoryStat {
  category: string
  a_votes: number
  b_votes: number
  shared: number
  agree: number
  agree_pct: number
}

export interface CompareResponse {
  user_a: CompareProfile
  user_b: CompareProfile
  shared_topic_count: number
  agree_count: number
  disagree_count: number
  agreement_pct: number
  shared_topics: SharedTopic[]
  category_stats: CategoryStat[]
  a_only_votes: number
  b_only_votes: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const usernameA = (searchParams.get('a') ?? '').trim().replace(/^@/, '')
  const usernameB = (searchParams.get('b') ?? '').trim().replace(/^@/, '')

  if (!usernameA || !usernameB) {
    return NextResponse.json(
      { error: 'Both ?a= and ?b= username params are required' },
      { status: 400 },
    )
  }

  if (usernameA.toLowerCase() === usernameB.toLowerCase()) {
    return NextResponse.json(
      { error: 'Cannot compare a user with themselves' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // Fetch both profiles in parallel
  const [{ data: profileA }, { data: profileB }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, bio, vote_streak',
      )
      .ilike('username', usernameA)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, bio, vote_streak',
      )
      .ilike('username', usernameB)
      .maybeSingle(),
  ])

  if (!profileA) {
    return NextResponse.json({ error: `User @${usernameA} not found` }, { status: 404 })
  }
  if (!profileB) {
    return NextResponse.json({ error: `User @${usernameB} not found` }, { status: 404 })
  }

  // Fetch votes for both users (votes are public per RLS)
  const [{ data: votesA }, { data: votesB }] = await Promise.all([
    supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', profileA.id)
      .limit(1000),
    supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', profileB.id)
      .limit(1000),
  ])

  const mapA = new Map<string, 'blue' | 'red'>(
    (votesA ?? []).map((v) => [v.topic_id, v.side as 'blue' | 'red']),
  )
  const mapB = new Map<string, 'blue' | 'red'>(
    (votesB ?? []).map((v) => [v.topic_id, v.side as 'blue' | 'red']),
  )

  // Find shared topics (both voted)
  const sharedTopicIds = Array.from(mapA.keys()).filter((id) => mapB.has(id))
  const aOnlyVotes = mapA.size - sharedTopicIds.length
  const bOnlyVotes = mapB.size - sharedTopicIds.length

  // Fetch topic metadata for shared topics (up to 200 most recent)
  const topicIdsToFetch = sharedTopicIds.slice(0, 200)
  let topicMeta: Array<{
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }> = []

  if (topicIdsToFetch.length > 0) {
    const { data } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIdsToFetch)
    topicMeta = data ?? []
  }

  const metaMap = new Map(topicMeta.map((t) => [t.id, t]))

  // Build shared topic list
  const sharedTopics: SharedTopic[] = sharedTopicIds
    .map((id) => {
      const meta = metaMap.get(id)
      if (!meta) return null
      const sideA = mapA.get(id)!
      const sideB = mapB.get(id)!
      return {
        id,
        statement: meta.statement,
        category: meta.category,
        status: meta.status,
        blue_pct: meta.blue_pct,
        total_votes: meta.total_votes,
        side_a: sideA,
        side_b: sideB,
        agree: sideA === sideB,
      }
    })
    .filter((t): t is SharedTopic => t !== null)

  const agreeCount = sharedTopics.filter((t) => t.agree).length
  const disagreeCount = sharedTopics.filter((t) => !t.agree).length
  const agreementPct =
    sharedTopics.length > 0 ? Math.round((agreeCount / sharedTopics.length) * 100) : 0

  // Category breakdown
  const catMap = new Map<string, { shared: number; agree: number; a_votes: number; b_votes: number }>()

  for (const t of sharedTopics) {
    const cat = t.category ?? 'Other'
    const entry = catMap.get(cat) ?? { shared: 0, agree: 0, a_votes: 0, b_votes: 0 }
    entry.shared++
    entry.a_votes++
    entry.b_votes++
    if (t.agree) entry.agree++
    catMap.set(cat, entry)
  }

  // Add category-only votes for A
  Array.from(mapA.keys()).forEach((topicId) => {
    if (mapB.has(topicId)) return
    const meta = metaMap.get(topicId)
    if (!meta) return
    const cat = meta.category ?? 'Other'
    const entry = catMap.get(cat) ?? { shared: 0, agree: 0, a_votes: 0, b_votes: 0 }
    entry.a_votes++
    catMap.set(cat, entry)
  })

  const categoryStats: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      a_votes: s.a_votes,
      b_votes: s.b_votes,
      shared: s.shared,
      agree: s.agree,
      agree_pct: s.shared > 0 ? Math.round((s.agree / s.shared) * 100) : 0,
    }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, 8)

  // Sort shared topics: disagreements first (more interesting), then agreements
  const sortedTopics = [...sharedTopics]
    .sort((a, b) => {
      if (a.agree !== b.agree) return a.agree ? 1 : -1
      return b.total_votes - a.total_votes
    })
    .slice(0, 30)

  return NextResponse.json({
    user_a: profileA as CompareProfile,
    user_b: profileB as CompareProfile,
    shared_topic_count: sharedTopics.length,
    agree_count: agreeCount,
    disagree_count: disagreeCount,
    agreement_pct: agreementPct,
    shared_topics: sortedTopics,
    category_stats: categoryStats,
    a_only_votes: aOnlyVotes,
    b_only_votes: bOnlyVotes,
  } satisfies CompareResponse)
}
