import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DelegateCandidate {
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
  alignment_pct: number | null
  topics_in_common: number
}

export interface DelegateSearchResponse {
  candidates: DelegateCandidate[]
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, role, total_votes, vote_streak, civic_archetype')
    .neq('id', user.id)
    .gt('total_votes', 10)
    .order('clout', { ascending: false })
    .limit(20)

  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
  }

  const { data: profiles } = await query
  const profileIds = (profiles ?? []).map((p: Record<string, unknown>) => p.id as string)

  // Fetch trusted_by counts and alignment in parallel
  const [trustedByRes, myVotesRes] = await Promise.all([
    profileIds.length > 0
      ? supabase
          .from('vote_delegations')
          .select('delegate_id')
          .in('delegate_id', profileIds)
          .is('revoked_at', null)
      : Promise.resolve({ data: [] }),
    supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .limit(500),
  ])

  const trustedByMap: Record<string, number> = {}
  for (const row of trustedByRes.data ?? []) {
    const r = row as { delegate_id: string }
    trustedByMap[r.delegate_id] = (trustedByMap[r.delegate_id] ?? 0) + 1
  }

  // Compute alignment scores using batch vote query
  const alignmentMap: Record<string, { pct: number; common: number }> = {}

  const myVotes = myVotesRes.data ?? []
  if (myVotes.length > 0 && profileIds.length > 0) {
    const myTopicIds = myVotes.map((v: { topic_id: string; side: string }) => v.topic_id)
    const myVoteBySide = new Map<string, string>(
      myVotes.map((v: { topic_id: string; side: string }) => [v.topic_id, v.side]),
    )

    // Single query: all candidate votes on topics the current user has voted on
    const { data: candidateVotes } = await supabase
      .from('votes')
      .select('user_id, topic_id, side')
      .in('user_id', profileIds)
      .in('topic_id', myTopicIds.slice(0, 300))

    // Tally per candidate
    const tally: Record<string, { matches: number; total: number }> = {}
    for (const row of candidateVotes ?? []) {
      const r = row as { user_id: string; topic_id: string; side: string }
      if (!tally[r.user_id]) tally[r.user_id] = { matches: 0, total: 0 }
      tally[r.user_id].total++
      if (myVoteBySide.get(r.topic_id) === r.side) tally[r.user_id].matches++
    }

    for (const [candidateId, { matches, total }] of Object.entries(tally)) {
      if (total >= 5) {
        alignmentMap[candidateId] = {
          pct: Math.round((matches / total) * 100),
          common: total,
        }
      }
    }
  }

  const candidates: DelegateCandidate[] = (profiles ?? []).map((p: Record<string, unknown>) => {
    const aln = alignmentMap[p.id as string]
    return {
      id: p.id as string,
      username: p.username as string,
      display_name: p.display_name as string | null,
      avatar_url: p.avatar_url as string | null,
      clout: p.clout as number,
      role: p.role as string,
      total_votes: p.total_votes as number,
      vote_streak: p.vote_streak as number,
      civic_archetype: p.civic_archetype as string | null,
      trusted_by: trustedByMap[p.id as string] ?? 0,
      alignment_pct: aln?.pct ?? null,
      topics_in_common: aln?.common ?? 0,
    }
  })

  return NextResponse.json({ candidates } satisfies DelegateSearchResponse)
}
