import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompareCandidate {
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

export interface CompareResponse {
  a: CompareCandidate | null
  b: CompareCandidate | null
  my_vote_count: number
  verdict: 'a' | 'b' | 'tied' | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildCandidate(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string,
  myVoteMap: Map<string, string>,
  topicCategoryMap: Map<string, string>,
  alreadyDelegatingSet: Set<string>,
  trustedByCount: number,
): Promise<CompareCandidate | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, role, total_votes, vote_streak, civic_archetype')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  const myTopicIds = Array.from(myVoteMap.keys())

  const { data: theirVotes } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', userId)
    .in('topic_id', myTopicIds.slice(0, 300))

  const overall = { matches: 0, total: 0 }
  const byCategory: Record<string, { matches: number; total: number }> = {}

  for (const row of theirVotes ?? []) {
    const r = row as { topic_id: string; side: string }
    overall.total++
    const match = myVoteMap.get(r.topic_id) === r.side
    if (match) overall.matches++

    const cat = topicCategoryMap.get(r.topic_id)
    if (cat) {
      if (!byCategory[cat]) byCategory[cat] = { matches: 0, total: 0 }
      byCategory[cat].total++
      if (match) byCategory[cat].matches++
    }
  }

  const alignment_pct = overall.total >= 5
    ? Math.round((overall.matches / overall.total) * 100)
    : 0

  const categories = Object.entries(byCategory)
    .filter(([, v]) => v.total >= 3)
    .map(([cat, v]) => ({
      category: cat,
      alignment_pct: Math.round((v.matches / v.total) * 100),
      count: v.total,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    id: profile.id as string,
    username: profile.username as string,
    display_name: profile.display_name as string | null,
    avatar_url: profile.avatar_url as string | null,
    clout: profile.clout as number,
    role: profile.role as string,
    total_votes: profile.total_votes as number,
    vote_streak: profile.vote_streak as number,
    civic_archetype: profile.civic_archetype as string | null,
    trusted_by: trustedByCount,
    alignment_pct,
    topics_in_common: overall.total,
    categories,
    already_delegating: alreadyDelegatingSet.has(userId),
  }
}

// ─── GET /api/delegation/compare?a=USER_ID&b=USER_ID ─────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const aId = searchParams.get('a')?.trim()
  const bId = searchParams.get('b')?.trim()

  // Fetch my votes once
  const { data: myVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  const myVotes = myVotesRaw ?? []
  const myVoteCount = myVotes.length
  const myVoteMap = new Map<string, string>(
    myVotes.map((v: { topic_id: string; side: string }) => [v.topic_id, v.side])
  )

  // Fetch topic categories for overlap computation
  const myTopicIds = myVotes.map((v: { topic_id: string }) => v.topic_id)
  const { data: topicsMeta } = myTopicIds.length > 0
    ? await supabase
        .from('topics')
        .select('id, category')
        .in('id', myTopicIds.slice(0, 300))
    : { data: [] }

  const topicCategoryMap = new Map<string, string>()
  for (const t of topicsMeta ?? []) {
    if (t.category) topicCategoryMap.set(t.id, t.category)
  }

  // My active delegations
  const { data: myDelegations } = await supabase
    .from('vote_delegations')
    .select('delegate_id')
    .eq('delegator_id', user.id)
    .is('revoked_at', null)

  const alreadyDelegatingSet = new Set(
    (myDelegations ?? []).map((d: { delegate_id: string }) => d.delegate_id)
  )

  // Trusted-by counts for a and b
  const candidateIds = [aId, bId].filter(Boolean) as string[]
  const { data: trustedByRows } = candidateIds.length > 0
    ? await supabase
        .from('vote_delegations')
        .select('delegate_id')
        .in('delegate_id', candidateIds)
        .is('revoked_at', null)
    : { data: [] }

  const trustedByMap: Record<string, number> = {}
  for (const r of trustedByRows ?? []) {
    const row = r as { delegate_id: string }
    trustedByMap[row.delegate_id] = (trustedByMap[row.delegate_id] ?? 0) + 1
  }

  // Build both candidates in parallel
  const [candidateA, candidateB] = await Promise.all([
    aId && aId !== user.id
      ? buildCandidate(supabase, aId, myVoteMap, topicCategoryMap, alreadyDelegatingSet, trustedByMap[aId] ?? 0)
      : Promise.resolve(null),
    bId && bId !== user.id
      ? buildCandidate(supabase, bId, myVoteMap, topicCategoryMap, alreadyDelegatingSet, trustedByMap[bId] ?? 0)
      : Promise.resolve(null),
  ])

  // Compute verdict
  let verdict: CompareResponse['verdict'] = null
  if (candidateA && candidateB) {
    if (candidateA.alignment_pct > candidateB.alignment_pct + 3) verdict = 'a'
    else if (candidateB.alignment_pct > candidateA.alignment_pct + 3) verdict = 'b'
    else verdict = 'tied'
  }

  return NextResponse.json({
    a: candidateA,
    b: candidateB,
    my_vote_count: myVoteCount,
    verdict,
  } satisfies CompareResponse)
}
