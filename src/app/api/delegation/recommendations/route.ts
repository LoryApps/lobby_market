import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RecommendedDelegate {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  role: string
  total_votes: number
  vote_streak: number
  civic_archetype: string | null
  trusted_by: number
  alignment_pct: number
  topics_in_common: number
  categories: { category: string; alignment_pct: number; count: number }[]
  already_delegating: boolean
}

export interface RecommendationsResponse {
  recommendations: RecommendedDelegate[]
  my_vote_count: number
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  // Fetch my votes (up to 500 most recent)
  const { data: myVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  const myVotes = myVotesRaw ?? []
  const myVoteCount = myVotes.length

  if (myVoteCount < 5) {
    // Not enough votes to compute alignment — return top users by clout
    const { data: topProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout, role, total_votes, vote_streak, civic_archetype')
      .neq('id', user.id)
      .gt('total_votes', 20)
      .order('clout', { ascending: false })
      .limit(limit)

    const results: RecommendedDelegate[] = (topProfiles ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      username: p.username as string,
      display_name: p.display_name as string | null,
      avatar_url: p.avatar_url as string | null,
      clout: p.clout as number,
      role: p.role as string,
      total_votes: p.total_votes as number,
      vote_streak: p.vote_streak as number,
      civic_archetype: p.civic_archetype as string | null,
      trusted_by: 0,
      alignment_pct: 0,
      topics_in_common: 0,
      categories: [],
      already_delegating: false,
    }))
    return NextResponse.json({ recommendations: results, my_vote_count: myVoteCount } satisfies RecommendationsResponse)
  }

  const myTopicIds = myVotes.map((v: { topic_id: string }) => v.topic_id)
  const myVoteMap = new Map<string, string>(
    myVotes.map((v: { topic_id: string; side: string }) => [v.topic_id, v.side])
  )

  // Fetch topic categories for the topics I voted on
  const { data: topicsMeta } = await supabase
    .from('topics')
    .select('id, category')
    .in('id', myTopicIds.slice(0, 300))

  const topicCategoryMap = new Map<string, string>()
  for (const t of topicsMeta ?? []) {
    if (t.category) topicCategoryMap.set(t.id, t.category)
  }

  // Fetch potential delegate candidates (active voters, not me)
  const { data: candidates } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, role, total_votes, vote_streak, civic_archetype')
    .neq('id', user.id)
    .gt('total_votes', 10)
    .order('total_votes', { ascending: false })
    .limit(100)
  const candidateIds = (candidates ?? []).map((p: Record<string, unknown>) => p.id as string)

  if (candidateIds.length === 0) {
    return NextResponse.json({ recommendations: [], my_vote_count: myVoteCount } satisfies RecommendationsResponse)
  }

  // Fetch all candidate votes on topics I've voted on
  const { data: candidateVotes } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('user_id', candidateIds)
    .in('topic_id', myTopicIds.slice(0, 300))

  // Fetch my active delegations
  const { data: myDelegations } = await supabase
    .from('vote_delegations')
    .select('delegate_id')
    .eq('delegator_id', user.id)
    .is('revoked_at', null)

  const alreadyDelegatingSet = new Set(
    (myDelegations ?? []).map((d: { delegate_id: string }) => d.delegate_id)
  )

  // Fetch trusted_by counts
  const { data: trustedByRows } = await supabase
    .from('vote_delegations')
    .select('delegate_id')
    .in('delegate_id', candidateIds)
    .is('revoked_at', null)

  const trustedByMap: Record<string, number> = {}
  for (const r of trustedByRows ?? []) {
    const row = r as { delegate_id: string }
    trustedByMap[row.delegate_id] = (trustedByMap[row.delegate_id] ?? 0) + 1
  }

  // Compute per-candidate alignment, including per-category breakdown
  const tallyMap: Record<string, {
    overall: { matches: number; total: number }
    byCategory: Record<string, { matches: number; total: number }>
  }> = {}

  for (const row of candidateVotes ?? []) {
    const r = row as { user_id: string; topic_id: string; side: string }
    if (!tallyMap[r.user_id]) {
      tallyMap[r.user_id] = { overall: { matches: 0, total: 0 }, byCategory: {} }
    }
    const tally = tallyMap[r.user_id]
    tally.overall.total++
    const match = myVoteMap.get(r.topic_id) === r.side
    if (match) tally.overall.matches++

    const cat = topicCategoryMap.get(r.topic_id)
    if (cat) {
      if (!tally.byCategory[cat]) tally.byCategory[cat] = { matches: 0, total: 0 }
      tally.byCategory[cat].total++
      if (match) tally.byCategory[cat].matches++
    }
  }

  // Build recommendation objects
  const recs: RecommendedDelegate[] = []

  for (const profile of candidates ?? []) {
    const p = profile as Record<string, unknown>
    const id = p.id as string
    const tally = tallyMap[id]

    if (!tally || tally.overall.total < 5) continue

    const alignmentPct = Math.round((tally.overall.matches / tally.overall.total) * 100)
    const topicsInCommon = tally.overall.total

    // Build category breakdown (only categories with ≥3 overlapping votes)
    const catBreakdown = Object.entries(tally.byCategory)
      .filter(([, v]) => v.total >= 3)
      .map(([cat, v]) => ({
        category: cat,
        alignment_pct: Math.round((v.matches / v.total) * 100),
        count: v.total,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)

    // Category filter: only include if this user has strong alignment in the requested category
    if (category) {
      const catData = tally.byCategory[category]
      if (!catData || catData.total < 3) continue
    }

    recs.push({
      id,
      username: p.username as string,
      display_name: p.display_name as string | null,
      avatar_url: p.avatar_url as string | null,
      clout: p.clout as number,
      role: p.role as string,
      total_votes: p.total_votes as number,
      vote_streak: p.vote_streak as number,
      civic_archetype: p.civic_archetype as string | null,
      trusted_by: trustedByMap[id] ?? 0,
      alignment_pct: alignmentPct,
      topics_in_common: topicsInCommon,
      categories: catBreakdown,
      already_delegating: alreadyDelegatingSet.has(id),
    })
  }

  // Sort by alignment_pct desc, then by topics_in_common desc
  recs.sort((a, b) => {
    if (b.alignment_pct !== a.alignment_pct) return b.alignment_pct - a.alignment_pct
    return b.topics_in_common - a.topics_in_common
  })

  return NextResponse.json({
    recommendations: recs.slice(0, limit),
    my_vote_count: myVoteCount,
  } satisfies RecommendationsResponse)
}
