import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmendmentArchitect {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  proposed: number
  ratified: number
  rejected: number
  pending: number
  success_rate: number  // ratified / (ratified + rejected) * 100
}

export interface AmendmentVoter {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  votes_cast: number
  for_votes: number
  against_votes: number
}

export interface RecentOutcome {
  amendment_id: string
  law_id: string
  law_statement: string
  title: string
  status: 'ratified' | 'rejected'
  for_count: number
  against_count: number
  proposer_username: string
  proposer_avatar: string | null
  resolved_at: string
}

export interface AmendmentLeaderboardResponse {
  proposers: AmendmentArchitect[]
  architects: AmendmentArchitect[]   // min 2 proposed, sorted by success_rate
  voters: AmendmentVoter[]
  recentOutcomes: RecentOutcome[]
  totals: {
    total_amendments: number
    ratified: number
    rejected: number
    pending: number
    unique_proposers: number
    unique_laws_amended: number
  }
  myStats: {
    proposed: number
    ratified: number
    success_rate: number
    votes_cast: number
    proposer_rank: number | null
    voter_rank: number | null
  } | null
}

const LIMIT = 25

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Fetch all amendments ──────────────────────────────────────────────────
  const { data: allAmendments } = await supabase
    .from('law_amendments')
    .select('id, law_id, proposer_id, status, for_count, against_count, title, ratified_at, created_at')
    .order('created_at', { ascending: false })

  const amendments = allAmendments ?? []

  // ── Fetch all amendment votes ─────────────────────────────────────────────
  const { data: amendmentVotesRaw } = await supabase
    .from('law_amendment_votes')
    .select('amendment_id, user_id, vote')

  const amendmentVotes = amendmentVotesRaw ?? []

  // ── Build proposer stats ─────────────────────────────────────────────────
  const proposerMap = new Map<string, {
    proposed: number
    ratified: number
    rejected: number
    pending: number
  }>()

  for (const a of amendments) {
    if (!proposerMap.has(a.proposer_id)) {
      proposerMap.set(a.proposer_id, { proposed: 0, ratified: 0, rejected: 0, pending: 0 })
    }
    const p = proposerMap.get(a.proposer_id)!
    p.proposed++
    if (a.status === 'ratified') p.ratified++
    else if (a.status === 'rejected') p.rejected++
    else p.pending++
  }

  // ── Build voter stats ─────────────────────────────────────────────────────
  const voterMap = new Map<string, { votes_cast: number; for_votes: number; against_votes: number }>()
  for (const v of amendmentVotes) {
    if (!voterMap.has(v.user_id)) {
      voterMap.set(v.user_id, { votes_cast: 0, for_votes: 0, against_votes: 0 })
    }
    const vv = voterMap.get(v.user_id)!
    vv.votes_cast++
    if (v.vote === true) vv.for_votes++
    else vv.against_votes++
  }

  // ── Collect all relevant user IDs ─────────────────────────────────────────
  const proposerIds = Array.from(proposerMap.keys())
  const voterIds = Array.from(voterMap.keys())
  const allUserIds = Array.from(new Set([...proposerIds, ...voterIds]))

  // ── Fetch profiles ────────────────────────────────────────────────────────
  const profileMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }>()

  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', allUserIds)

    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }
  }

  // ── Build proposers list ──────────────────────────────────────────────────
  const proposersList: AmendmentArchitect[] = []
  for (const [uid, stats] of proposerMap) {
    const prof = profileMap.get(uid)
    if (!prof) continue
    const resolved = stats.ratified + stats.rejected
    const successRate = resolved > 0 ? Math.round((stats.ratified / resolved) * 100) : 0
    proposersList.push({
      user_id: uid,
      username: prof.username,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      role: prof.role,
      clout: prof.clout,
      proposed: stats.proposed,
      ratified: stats.ratified,
      rejected: stats.rejected,
      pending: stats.pending,
      success_rate: successRate,
    })
  }

  // Sort proposers by most amendments proposed
  proposersList.sort((a, b) => b.proposed - a.proposed || b.ratified - a.ratified)
  const topProposers = proposersList.slice(0, LIMIT)

  // Sort architects by success rate (min 2 proposed with at least 1 resolved)
  const architectsList = proposersList
    .filter((p) => p.proposed >= 2 && (p.ratified + p.rejected) >= 1)
    .sort((a, b) => b.success_rate - a.success_rate || b.proposed - a.proposed)
    .slice(0, LIMIT)

  // ── Build voters list ────────────────────────────────────────────────────
  const votersList: AmendmentVoter[] = []
  for (const [uid, stats] of voterMap) {
    const prof = profileMap.get(uid)
    if (!prof) continue
    votersList.push({
      user_id: uid,
      username: prof.username,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      role: prof.role,
      clout: prof.clout,
      ...stats,
    })
  }
  votersList.sort((a, b) => b.votes_cast - a.votes_cast)
  const topVoters = votersList.slice(0, LIMIT)

  // ── Recent resolved outcomes ──────────────────────────────────────────────
  const resolved = amendments
    .filter((a) => a.status === 'ratified' || a.status === 'rejected')
    .slice(0, 20)

  const resolvedLawIds = Array.from(new Set(resolved.map((a) => a.law_id)))
  const lawMap = new Map<string, string>()
  if (resolvedLawIds.length > 0) {
    const { data: laws } = await supabase
      .from('laws')
      .select('id, statement')
      .in('id', resolvedLawIds)
    for (const l of laws ?? []) lawMap.set(l.id, l.statement)
  }

  const recentOutcomes: RecentOutcome[] = resolved.slice(0, 10).map((a) => {
    const prof = profileMap.get(a.proposer_id)
    return {
      amendment_id: a.id,
      law_id: a.law_id,
      law_statement: lawMap.get(a.law_id) ?? 'Unknown law',
      title: a.title,
      status: a.status as 'ratified' | 'rejected',
      for_count: a.for_count ?? 0,
      against_count: a.against_count ?? 0,
      proposer_username: prof?.username ?? 'unknown',
      proposer_avatar: prof?.avatar_url ?? null,
      resolved_at: a.ratified_at ?? a.created_at,
    }
  })

  // ── Platform totals ──────────────────────────────────────────────────────
  const uniqueLaws = new Set(amendments.map((a) => a.law_id)).size
  const totals = {
    total_amendments: amendments.length,
    ratified: amendments.filter((a) => a.status === 'ratified').length,
    rejected: amendments.filter((a) => a.status === 'rejected').length,
    pending: amendments.filter((a) => a.status === 'pending').length,
    unique_proposers: proposerMap.size,
    unique_laws_amended: uniqueLaws,
  }

  // ── My stats ─────────────────────────────────────────────────────────────
  let myStats: AmendmentLeaderboardResponse['myStats'] = null
  if (user) {
    const mine = proposerMap.get(user.id)
    const myVotes = voterMap.get(user.id)
    const proposerRank = topProposers.findIndex((p) => p.user_id === user.id)
    const voterRank = topVoters.findIndex((v) => v.user_id === user.id)
    myStats = {
      proposed: mine?.proposed ?? 0,
      ratified: mine?.ratified ?? 0,
      success_rate: mine
        ? mine.ratified + mine.rejected > 0
          ? Math.round((mine.ratified / (mine.ratified + mine.rejected)) * 100)
          : 0
        : 0,
      votes_cast: myVotes?.votes_cast ?? 0,
      proposer_rank: proposerRank >= 0 ? proposerRank + 1 : null,
      voter_rank: voterRank >= 0 ? voterRank + 1 : null,
    }
  }

  return NextResponse.json({
    proposers: topProposers,
    architects: architectsList,
    voters: topVoters,
    recentOutcomes,
    totals,
    myStats,
  } satisfies AmendmentLeaderboardResponse)
}
