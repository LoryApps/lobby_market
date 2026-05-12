import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: string | null
  judged: number
  for_picks: number
  against_picks: number
}

export interface RecentFaceoffVote {
  argument_a_id: string
  argument_b_id: string
  winner_id: string
  created_at: string
  winner_content: string | null
  winner_side: 'blue' | 'red' | null
  winner_upvotes: number | null
  topic_statement: string | null
  topic_category: string | null
  topic_id: string | null
  // How many total community votes landed on this same pair
  pair_total_votes: number
  // How many picked the same argument as the user
  pair_agreement_votes: number
  // Did the majority agree with the user?
  majority_agreed: boolean | null
}

export type JudgeArchetype =
  | 'maverick'     // alignment < 40%
  | 'contrarian'   // alignment 40-50%
  | 'consensus'    // alignment 50-65%
  | 'oracle'       // alignment >= 65%
  | 'newcomer'     // < 10 faceoffs judged

export interface FaceoffJudgingStats {
  total_judged: number
  week_judged: number
  // null when < 3 resolved pairs
  alignment_rate: number | null
  // % of picks that chose a FOR (blue) argument; null when < 3
  for_pick_rate: number | null
  category_breakdown: CategoryStat[]
  recent_votes: RecentFaceoffVote[]
  archetype: JudgeArchetype
  // Peak daily judging this calendar year
  peak_daily: number
  // Days with at least 1 faceoff judged this calendar year
  active_days: number
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch all of the user's faceoff votes (no limit — we need full history)
  const { data: userVotes, error: votesError } = await supabase
    .from('argument_faceoff_votes')
    .select('argument_a_id, argument_b_id, winner_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (votesError) {
    return NextResponse.json({ error: votesError.message }, { status: 500 })
  }

  const votes = userVotes ?? []

  if (votes.length === 0) {
    return NextResponse.json({
      total_judged: 0,
      week_judged: 0,
      alignment_rate: null,
      for_pick_rate: null,
      category_breakdown: [],
      recent_votes: [],
      archetype: 'newcomer',
      peak_daily: 0,
      active_days: 0,
    } satisfies FaceoffJudgingStats)
  }

  // 2. Week count
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekJudged = votes.filter(
    (v) => new Date(v.created_at) >= weekAgo
  ).length

  // 3. Fetch details for the winner argument + topic for the most recent 30 votes
  const recentSlice = votes.slice(0, 30)
  const winnerIds = [...new Set(recentSlice.map((v) => v.winner_id))]

  const { data: winnerArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, topic_id, topics!inner(id, statement, category)')
    .in('id', winnerIds)

  // Build lookup maps
  type ArgRow = {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    topic_id: string
    topics: { id: string; statement: string; category: string | null } | { id: string; statement: string; category: string | null }[]
  }
  const argById: Record<string, ArgRow> = {}
  for (const a of (winnerArgs ?? []) as ArgRow[]) {
    argById[a.id] = a
  }

  // 4. Fetch community vote counts for recent pairs to compute alignment
  //    Canonical pairs: always stored as lower UUID first
  //    Build the OR filter for each pair
  const pairFilter = recentSlice
    .map((v) => `and(argument_a_id.eq.${v.argument_a_id},argument_b_id.eq.${v.argument_b_id})`)
    .join(',')

  let pairData: { argument_a_id: string; argument_b_id: string; winner_id: string }[] = []
  if (recentSlice.length > 0) {
    const { data } = await supabase
      .from('argument_faceoff_votes')
      .select('argument_a_id, argument_b_id, winner_id')
      .or(pairFilter)
    pairData = data ?? []
  }

  // Aggregate pair results
  type PairKey = string
  const pairTotals: Record<PairKey, Record<string, number>> = {}
  for (const row of pairData) {
    const key = `${row.argument_a_id}|${row.argument_b_id}`
    if (!pairTotals[key]) pairTotals[key] = {}
    pairTotals[key][row.winner_id] = (pairTotals[key][row.winner_id] ?? 0) + 1
  }

  function majorityWinner(pairKey: PairKey): string | null {
    const counts = pairTotals[pairKey]
    if (!counts) return null
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
  }

  // Build recent_votes
  const recentVotes: RecentFaceoffVote[] = recentSlice.map((v) => {
    const winner = argById[v.winner_id]
    const pairKey = `${v.argument_a_id}|${v.argument_b_id}`
    const pairCounts = pairTotals[pairKey] ?? {}
    const pairTotal = Object.values(pairCounts).reduce((s, c) => s + c, 0)
    const pairAgree = pairCounts[v.winner_id] ?? 0
    const majority = majorityWinner(pairKey)
    const topicRaw = winner?.topics
    const topic = Array.isArray(topicRaw) ? topicRaw[0] : topicRaw

    return {
      argument_a_id: v.argument_a_id,
      argument_b_id: v.argument_b_id,
      winner_id: v.winner_id,
      created_at: v.created_at,
      winner_content: winner?.content?.slice(0, 200) ?? null,
      winner_side: winner?.side ?? null,
      winner_upvotes: winner?.upvotes ?? null,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      topic_id: topic?.id ?? null,
      pair_total_votes: pairTotal,
      pair_agreement_votes: pairAgree,
      majority_agreed: majority !== null ? majority === v.winner_id : null,
    }
  })

  // 5. Compute alignment rate across all recent pairs that have community data
  const resolved = recentVotes.filter((v) => v.majority_agreed !== null)
  const alignedCount = resolved.filter((v) => v.majority_agreed === true).length
  const alignmentRate =
    resolved.length >= 3
      ? Math.round((alignedCount / resolved.length) * 100)
      : null

  // 6. For-pick rate across ALL user votes
  //    Need to fetch the side of each winner argument
  const allWinnerIds = [...new Set(votes.map((v) => v.winner_id))]
  const { data: allWinners } = await supabase
    .from('topic_arguments')
    .select('id, side, topic_id, topics!inner(id, category)')
    .in('id', allWinnerIds)

  type WinnerRow = {
    id: string
    side: 'blue' | 'red'
    topic_id: string
    topics: { id: string; category: string | null } | { id: string; category: string | null }[]
  }

  const sideById: Record<string, 'blue' | 'red'> = {}
  const categoryById: Record<string, string | null> = {}
  for (const a of (allWinners ?? []) as WinnerRow[]) {
    sideById[a.id] = a.side
    const topicRaw = a.topics
    const topic = Array.isArray(topicRaw) ? topicRaw[0] : topicRaw
    categoryById[a.id] = topic?.category ?? null
  }

  let forPicks = 0
  let sideKnown = 0
  for (const v of votes) {
    const side = sideById[v.winner_id]
    if (side) {
      sideKnown++
      if (side === 'blue') forPicks++
    }
  }
  const forPickRate = sideKnown >= 3 ? Math.round((forPicks / sideKnown) * 100) : null

  // 7. Category breakdown
  const catMap: Record<
    string,
    { judged: number; for_picks: number; against_picks: number }
  > = {}

  for (const v of votes) {
    const cat = categoryById[v.winner_id] ?? 'Unknown'
    const side = sideById[v.winner_id]
    if (!catMap[cat]) catMap[cat] = { judged: 0, for_picks: 0, against_picks: 0 }
    catMap[cat].judged++
    if (side === 'blue') catMap[cat].for_picks++
    else if (side === 'red') catMap[cat].against_picks++
  }

  const categoryBreakdown: CategoryStat[] = Object.entries(catMap)
    .sort(([, a], [, b]) => b.judged - a.judged)
    .slice(0, 8)
    .map(([category, stats]) => ({
      category: category === 'Unknown' ? null : category,
      ...stats,
    }))

  // 8. Peak daily + active days (calendar year)
  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const yearVotes = votes.filter((v) => new Date(v.created_at) >= yearAgo)
  const dayMap: Record<string, number> = {}
  for (const v of yearVotes) {
    const day = v.created_at.slice(0, 10)
    dayMap[day] = (dayMap[day] ?? 0) + 1
  }
  const peakDaily = Math.max(0, ...Object.values(dayMap))
  const activeDays = Object.keys(dayMap).length

  // 9. Archetype
  let archetype: JudgeArchetype
  if (votes.length < 10) {
    archetype = 'newcomer'
  } else if (alignmentRate === null || alignmentRate < 40) {
    archetype = 'maverick'
  } else if (alignmentRate < 50) {
    archetype = 'contrarian'
  } else if (alignmentRate < 65) {
    archetype = 'consensus'
  } else {
    archetype = 'oracle'
  }

  return NextResponse.json({
    total_judged: votes.length,
    week_judged: weekJudged,
    alignment_rate: alignmentRate,
    for_pick_rate: forPickRate,
    category_breakdown: categoryBreakdown,
    recent_votes: recentVotes,
    archetype,
    peak_daily: peakDaily,
    active_days: activeDays,
  } satisfies FaceoffJudgingStats)
}
