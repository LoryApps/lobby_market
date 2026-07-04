import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 180 // 3-minute cache

// ─── Types ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

const TIER_RANK = { sage: 3, expert: 2, contributor: 1 } as const

export interface CivicVoice {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  rank: number
  argument_upvotes: number
  votes_cast: number
  accepted_answers: number
  expertise_tier: 'contributor' | 'expert' | 'sage' | null
  topic_count: number
}

export interface VoicesResponse {
  voices: CivicVoice[]
  category: string
  sort: string
  total_voices: number
  generated_at: string
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? 'all'
  const sort = searchParams.get('sort') ?? 'arguments'
  const limit = Math.min(Number(searchParams.get('limit') ?? 24), 50)

  const supabase = await createClient()

  // 1. Fetch topics scoped to the selected category (or all civic categories)
  let topicsQuery = supabase
    .from('topics')
    .select('id, category')
    .not('status', 'eq', 'archived')

  const isSpecificCategory = category !== 'all' && CATEGORIES.includes(category as (typeof CATEGORIES)[number])
  if (isSpecificCategory) {
    topicsQuery = topicsQuery.eq('category', category)
  } else {
    topicsQuery = topicsQuery.in('category', CATEGORIES as unknown as string[])
  }

  const { data: topicsRaw } = await topicsQuery
  const topics = topicsRaw ?? []
  const topicIds = topics.map((t) => t.id)

  if (topicIds.length === 0) {
    return NextResponse.json({
      voices: [],
      category,
      sort,
      total_voices: 0,
      generated_at: new Date().toISOString(),
    } satisfies VoicesResponse)
  }

  // 2. Fetch argument upvotes for in-scope topics
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('user_id, upvotes, topic_id')
    .in('topic_id', topicIds)
    .gt('upvotes', 0)

  const args = (argsRaw ?? []) as Array<{ user_id: string; upvotes: number; topic_id: string }>

  // 3. Fetch votes cast for in-scope topics
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id')
    .in('topic_id', topicIds)

  const voteCasts = (votesRaw ?? []) as Array<{ user_id: string; topic_id: string }>

  // 4. Fetch Q&A expertise
  let expertiseQuery = supabase
    .from('qa_user_expertise')
    .select('user_id, category, accepted_count, tier')

  if (isSpecificCategory) {
    expertiseQuery = expertiseQuery.eq('category', category)
  } else {
    expertiseQuery = expertiseQuery.in('category', CATEGORIES as unknown as string[])
  }

  const { data: expertiseRaw } = await expertiseQuery
  const expertise = (expertiseRaw ?? []) as Array<{
    user_id: string
    category: string
    accepted_count: number
    tier: string
  }>

  // 5. Aggregate per user
  const userArgUpvotes = new Map<string, number>()
  const userVoteCount = new Map<string, number>()
  const userTopicSet = new Map<string, Set<string>>()

  for (const r of args) {
    userArgUpvotes.set(r.user_id, (userArgUpvotes.get(r.user_id) ?? 0) + r.upvotes)
    if (!userTopicSet.has(r.user_id)) userTopicSet.set(r.user_id, new Set())
    userTopicSet.get(r.user_id)!.add(r.topic_id)
  }

  for (const r of voteCasts) {
    userVoteCount.set(r.user_id, (userVoteCount.get(r.user_id) ?? 0) + 1)
    if (!userTopicSet.has(r.user_id)) userTopicSet.set(r.user_id, new Set())
    userTopicSet.get(r.user_id)!.add(r.topic_id)
  }

  // Q&A: keep the highest tier per user (for "all" view) or the specific category tier
  const userExpertise = new Map<string, { accepted_answers: number; tier: string }>()
  for (const e of expertise) {
    const existing = userExpertise.get(e.user_id)
    const newRank = TIER_RANK[e.tier as keyof typeof TIER_RANK] ?? 0
    const existingRank = existing ? (TIER_RANK[existing.tier as keyof typeof TIER_RANK] ?? 0) : 0
    if (!existing || newRank > existingRank) {
      userExpertise.set(e.user_id, { accepted_answers: e.accepted_count, tier: e.tier })
    }
  }

  // 6. Fetch profiles for all users with any activity
  const allUserIds = new Set<string>([...userArgUpvotes.keys(), ...userVoteCount.keys()])

  if (allUserIds.size === 0) {
    return NextResponse.json({
      voices: [],
      category,
      sort,
      total_voices: 0,
      generated_at: new Date().toISOString(),
    } satisfies VoicesResponse)
  }

  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score')
    .in('id', Array.from(allUserIds))

  const profiles = (profilesRaw ?? []) as Array<{
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
  }>

  // 7. Build voice records
  let voices: CivicVoice[] = profiles.map((p) => {
    const exp = userExpertise.get(p.id)
    return {
      user_id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role ?? 'person',
      clout: p.clout ?? 0,
      reputation_score: p.reputation_score ?? 0,
      rank: 0,
      argument_upvotes: userArgUpvotes.get(p.id) ?? 0,
      votes_cast: userVoteCount.get(p.id) ?? 0,
      accepted_answers: exp?.accepted_answers ?? 0,
      expertise_tier: (exp?.tier ?? null) as CivicVoice['expertise_tier'],
      topic_count: userTopicSet.get(p.id)?.size ?? 0,
    }
  })

  const totalVoices = voices.length

  // Sort
  if (sort === 'votes') {
    voices.sort((a, b) => b.votes_cast - a.votes_cast || b.clout - a.clout)
  } else if (sort === 'expertise') {
    voices.sort((a, b) => {
      const ta = TIER_RANK[a.expertise_tier as keyof typeof TIER_RANK] ?? 0
      const tb = TIER_RANK[b.expertise_tier as keyof typeof TIER_RANK] ?? 0
      return tb - ta || b.accepted_answers - a.accepted_answers || b.clout - a.clout
    })
  } else {
    // default: argument upvotes
    voices.sort((a, b) => b.argument_upvotes - a.argument_upvotes || b.clout - a.clout)
  }

  voices = voices.slice(0, limit).map((v, i) => ({ ...v, rank: i + 1 }))

  return NextResponse.json({
    voices,
    category,
    sort,
    total_voices: totalVoices,
    generated_at: new Date().toISOString(),
  } satisfies VoicesResponse)
}
