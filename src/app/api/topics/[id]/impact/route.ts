import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImpactArgument {
  id: string
  body: string
  side: 'for' | 'against'
  upvotes: number
  ai_grade: string | null
  ai_score: number | null
  reply_count: number
  citation_count: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string | null
  } | null
  impact_score: number
  impact_rank: number
}

export interface ImpactSideStats {
  argument_count: number
  avg_upvotes: number
  avg_ai_score: number | null
  top_grade: string | null
  total_impact: number
  avg_impact: number
}

export interface TopicImpactData {
  topic_id: string
  topic_statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_arguments: number
  for_stats: ImpactSideStats
  against_stats: ImpactSideStats
  winning_side: 'for' | 'against' | 'tie'
  winning_margin: number
  top_for_args: ImpactArgument[]
  top_against_args: ImpactArgument[]
  // Grade distribution across all arguments
  grade_distribution: Record<string, number>
  // Engagement breakdown
  total_upvotes: number
  total_replies: number
  total_citations: number
}

// ─── Impact score formula ─────────────────────────────────────────────────────
// Weighted composite: upvotes (most democratic signal), quality score,
// and reply depth (engagement indicator).
function computeImpactScore(
  upvotes: number,
  aiScore: number | null,
  replyCount: number,
  citationCount: number,
  aiGrade: string | null,
): number {
  const baseUpvotes = upvotes * 3
  const qualityBonus = aiScore != null ? aiScore * 8 : 0
  const replyBonus = replyCount * 2
  const citationBonus = citationCount * 4
  // Bonus for exceptional grades
  const gradeBonus = aiGrade === 'A' ? 15 : aiGrade === 'B' ? 8 : 0
  return Math.round(baseUpvotes + qualityBonus + replyBonus + citationBonus + gradeBonus)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch topic metadata
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch arguments with AI scores
  const { data: rawArgs, error: argsError } = await supabase
    .from('topic_arguments')
    .select('id, body, side, upvotes, ai_grade, ai_score, reply_count, created_at, user_id')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(200)

  if (argsError) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  if (args.length === 0) {
    const empty: TopicImpactData = {
      topic_id: topic.id,
      topic_statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      total_arguments: 0,
      for_stats: { argument_count: 0, avg_upvotes: 0, avg_ai_score: null, top_grade: null, total_impact: 0, avg_impact: 0 },
      against_stats: { argument_count: 0, avg_upvotes: 0, avg_ai_score: null, top_grade: null, total_impact: 0, avg_impact: 0 },
      winning_side: 'tie',
      winning_margin: 0,
      top_for_args: [],
      top_against_args: [],
      grade_distribution: {},
      total_upvotes: 0,
      total_replies: 0,
      total_citations: 0,
    }
    return NextResponse.json(empty)
  }

  // Fetch citation counts per argument
  const argIds = args.map((a) => a.id)
  const { data: citationRows } = await supabase
    .from('argument_citations')
    .select('argument_id')
    .in('argument_id', argIds)

  const citationCountMap: Record<string, number> = {}
  for (const row of citationRows ?? []) {
    citationCountMap[row.argument_id] = (citationCountMap[row.argument_id] ?? 0) + 1
  }

  // Batch-fetch author profiles
  const userIds = Array.from(new Set(args.map((a) => a.user_id).filter(Boolean)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', userIds)

  const profileMap: Record<string, { username: string; display_name: string | null; avatar_url: string | null; role: string | null }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = p
  }

  // Compute impact scores and enrich arguments
  const enriched = args.map((a) => {
    const citations = citationCountMap[a.id] ?? 0
    const score = computeImpactScore(
      a.upvotes ?? 0,
      a.ai_score ?? null,
      a.reply_count ?? 0,
      citations,
      a.ai_grade ?? null,
    )
    return {
      id: a.id,
      body: a.body,
      side: a.side as 'for' | 'against',
      upvotes: a.upvotes ?? 0,
      ai_grade: a.ai_grade ?? null,
      ai_score: a.ai_score ?? null,
      reply_count: a.reply_count ?? 0,
      citation_count: citations,
      created_at: a.created_at,
      author: profileMap[a.user_id] ?? null,
      impact_score: score,
      impact_rank: 0,
    }
  })

  // Split by side
  const forArgs = enriched
    .filter((a) => a.side === 'for')
    .sort((a, b) => b.impact_score - a.impact_score)
  const againstArgs = enriched
    .filter((a) => a.side === 'against')
    .sort((a, b) => b.impact_score - a.impact_score)

  // Assign ranks within each side
  forArgs.forEach((a, i) => { a.impact_rank = i + 1 })
  againstArgs.forEach((a, i) => { a.impact_rank = i + 1 })

  // Compute side stats
  function sideStats(list: typeof enriched): ImpactSideStats {
    if (list.length === 0) return { argument_count: 0, avg_upvotes: 0, avg_ai_score: null, top_grade: null, total_impact: 0, avg_impact: 0 }
    const avgUpvotes = list.reduce((s, a) => s + a.upvotes, 0) / list.length
    const scored = list.filter((a) => a.ai_score != null)
    const avgScore = scored.length > 0 ? scored.reduce((s, a) => s + (a.ai_score ?? 0), 0) / scored.length : null
    const graded = list.filter((a) => a.ai_grade != null)
    const gradeOrder = ['A', 'B', 'C', 'D', 'F']
    const topGrade = graded.length > 0
      ? gradeOrder.find((g) => graded.some((a) => a.ai_grade === g)) ?? null
      : null
    const totalImpact = list.reduce((s, a) => s + a.impact_score, 0)
    return {
      argument_count: list.length,
      avg_upvotes: Math.round(avgUpvotes * 10) / 10,
      avg_ai_score: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
      top_grade: topGrade,
      total_impact: totalImpact,
      avg_impact: list.length > 0 ? Math.round(totalImpact / list.length) : 0,
    }
  }

  const forStats = sideStats(forArgs)
  const againstStats = sideStats(againstArgs)

  const margin = forStats.avg_impact - againstStats.avg_impact
  const THRESHOLD = 5
  const winningSide: 'for' | 'against' | 'tie' =
    Math.abs(margin) < THRESHOLD ? 'tie' : margin > 0 ? 'for' : 'against'

  // Grade distribution across all arguments
  const gradeDist: Record<string, number> = {}
  for (const a of enriched) {
    if (a.ai_grade) gradeDist[a.ai_grade] = (gradeDist[a.ai_grade] ?? 0) + 1
  }

  const result: TopicImpactData = {
    topic_id: topic.id,
    topic_statement: topic.statement,
    category: topic.category,
    status: topic.status,
    blue_pct: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,
    total_arguments: enriched.length,
    for_stats: forStats,
    against_stats: againstStats,
    winning_side: winningSide,
    winning_margin: Math.abs(Math.round(margin)),
    top_for_args: forArgs.slice(0, 5),
    top_against_args: againstArgs.slice(0, 5),
    grade_distribution: gradeDist,
    total_upvotes: enriched.reduce((s, a) => s + a.upvotes, 0),
    total_replies: enriched.reduce((s, a) => s + a.reply_count, 0),
    total_citations: enriched.reduce((s, a) => s + a.citation_count, 0),
  }

  return NextResponse.json(result)
}
