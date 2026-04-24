import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawRecord {
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  final_pct: number
  established_at: string | null
  won: boolean
}

export interface FailedRecord {
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  final_pct: number
  resolved_at: string
  won: boolean
}

export interface TopArgument {
  id: string
  topic_id: string
  topic_statement: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
}

export interface ActiveStake {
  topic_id: string
  statement: string
  category: string | null
  status: string
  side: 'blue' | 'red'
  blue_pct: number
  total_votes: number
  voted_at: string
  is_winning: boolean
}

export interface ImpactData {
  impact_score: number
  laws_championed: LawRecord[]
  correct_against: FailedRecord[]
  top_arguments: TopArgument[]
  active_stakes: ActiveStake[]
  stats: {
    total_laws_shaped: number
    total_correct_calls: number
    total_active_stakes: number
    law_win_rate: number | null
    all_win_rate: number | null
    resolved_count: number
    arg_total_upvotes: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user votes with topic info
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(2000)

  const votes = votesRaw ?? []
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  if (topicIds.length === 0) {
    return NextResponse.json({
      impact_score: 0,
      laws_championed: [],
      correct_against: [],
      top_arguments: [],
      active_stakes: [],
      stats: {
        total_laws_shaped: 0,
        total_correct_calls: 0,
        total_active_stakes: 0,
        law_win_rate: null,
        all_win_rate: null,
        resolved_count: 0,
        arg_total_upvotes: 0,
      },
    } satisfies ImpactData)
  }

  // Fetch topic details for all voted topics
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, updated_at')
    .in('id', topicIds)

  const topicMap = new Map(
    (topicsRaw ?? []).map((t) => [t.id, t])
  )

  // Build vote map: topic_id → most recent vote record
  const voteMap = new Map<string, { side: 'blue' | 'red'; created_at: string }>()
  for (const v of votes) {
    if (!voteMap.has(v.topic_id)) {
      voteMap.set(v.topic_id, { side: v.side as 'blue' | 'red', created_at: v.created_at })
    }
  }

  // Fetch law timestamps for championed laws
  const lawTopicIds = Array.from(voteMap.entries())
    .filter(([tid]) => topicMap.get(tid)?.status === 'law')
    .map(([tid]) => tid)

  const { data: lawsRaw } = await supabase
    .from('laws')
    .select('topic_id, established_at')
    .in('topic_id', lawTopicIds)

  const lawTimestampMap = new Map(
    (lawsRaw ?? []).map((l) => [l.topic_id, l.established_at as string | null])
  )

  // ── Categorize votes ──────────────────────────────────────────────────────

  const lawsChampioned: LawRecord[] = []
  const correctAgainst: FailedRecord[] = []
  const activeStakes: ActiveStake[] = []

  let resolvedCount = 0
  let correctCount = 0

  for (const [topicId, vote] of Array.from(voteMap.entries())) {
    const topic = topicMap.get(topicId)
    if (!topic) continue

    const { status, statement, category, blue_pct, total_votes, updated_at } = topic

    if (status === 'law') {
      resolvedCount++
      const won = vote.side === 'blue'
      if (won) correctCount++
      lawsChampioned.push({
        topic_id: topicId,
        statement,
        category,
        side: vote.side,
        final_pct: blue_pct,
        established_at: lawTimestampMap.get(topicId) ?? updated_at,
        won,
      })
    } else if (status === 'failed') {
      resolvedCount++
      const won = vote.side === 'red'
      if (won) correctCount++
      correctAgainst.push({
        topic_id: topicId,
        statement,
        category,
        side: vote.side,
        final_pct: blue_pct,
        resolved_at: updated_at,
        won,
      })
    } else if (status === 'active' || status === 'voting' || status === 'proposed') {
      const isWinning =
        (vote.side === 'blue' && blue_pct >= 50) ||
        (vote.side === 'red' && blue_pct < 50)
      activeStakes.push({
        topic_id: topicId,
        statement,
        category,
        status,
        side: vote.side,
        blue_pct,
        total_votes,
        voted_at: vote.created_at,
        is_winning: isWinning,
      })
    }
  }

  // Sort: laws by established date desc, failed by resolved date desc, active by vote recency
  lawsChampioned.sort(
    (a, b) =>
      new Date(b.established_at ?? 0).getTime() -
      new Date(a.established_at ?? 0).getTime()
  )
  correctAgainst.sort(
    (a, b) =>
      new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime()
  )
  activeStakes.sort(
    (a, b) => new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime()
  )

  // ── Top arguments ─────────────────────────────────────────────────────────

  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, content, side, upvotes, created_at')
    .eq('user_id', user.id)
    .order('upvotes', { ascending: false })
    .limit(20)

  const args = argsRaw ?? []
  const argTopicIds = Array.from(new Set(args.map((a) => a.topic_id)))

  let argTopicMap = new Map<string, string>()
  if (argTopicIds.length > 0) {
    const { data: argTopics } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', argTopicIds)
    argTopicMap = new Map((argTopics ?? []).map((t) => [t.id, t.statement]))
  }

  const topArguments: TopArgument[] = args
    .filter((a) => a.upvotes > 0)
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      topic_id: a.topic_id,
      topic_statement: argTopicMap.get(a.topic_id) ?? 'Unknown topic',
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes,
      created_at: a.created_at,
    }))

  const argTotalUpvotes = args.reduce((sum, a) => sum + (a.upvotes ?? 0), 0)

  // ── Impact score ──────────────────────────────────────────────────────────
  // Laws championed: 15 pts each
  // Correct "against" calls: 8 pts each
  // Arg upvotes: 1 pt each
  // Active winning stakes: 2 pts each

  const impactScore =
    lawsChampioned.filter((l) => l.won).length * 15 +
    correctAgainst.filter((c) => c.won).length * 8 +
    argTotalUpvotes * 1 +
    activeStakes.filter((s) => s.is_winning).length * 2

  const lawWinRate =
    lawsChampioned.length > 0
      ? Math.round(
          (lawsChampioned.filter((l) => l.won).length / lawsChampioned.length) * 100
        )
      : null

  const allWinRate =
    resolvedCount > 0 ? Math.round((correctCount / resolvedCount) * 100) : null

  return NextResponse.json({
    impact_score: impactScore,
    laws_championed: lawsChampioned.slice(0, 30),
    correct_against: correctAgainst.slice(0, 20),
    top_arguments: topArguments,
    active_stakes: activeStakes.slice(0, 20),
    stats: {
      total_laws_shaped: lawsChampioned.length,
      total_correct_calls: correctAgainst.filter((c) => c.won).length,
      total_active_stakes: activeStakes.length,
      law_win_rate: lawWinRate,
      all_win_rate: allWinRate,
      resolved_count: resolvedCount,
      arg_total_upvotes: argTotalUpvotes,
    },
  } satisfies ImpactData)
}
