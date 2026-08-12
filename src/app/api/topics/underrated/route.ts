import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnderratedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  created_at: string
  /** Average AI score of scored arguments on this topic (1–10) */
  avg_ai_score: number
  /** Number of arguments with an AI score */
  scored_arg_count: number
  /** Total arguments (scored + unscored) */
  total_arg_count: number
  /** Composite underrated score = avg_ai_score × sqrt(scored_args) / log2(total_votes + 2) */
  underrated_score: number
  /** Dominant side: 'for' | 'against' | 'balanced' */
  argument_balance: 'for' | 'against' | 'balanced'
}

export interface UnderratedTopicsResponse {
  topics: UnderratedTopic[]
  total: number
  categories: string[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Minimum average ai_score for a topic to qualify as "quality" */
const MIN_AVG_SCORE = 6.0
/** Minimum number of scored arguments to qualify */
const MIN_SCORED_ARGS = 2
/** Topics with more total_votes than this are considered "mainstream" and excluded */
const MAX_VOTES = 3000
/** Topics need at least this many votes to have real signal */
const MIN_VOTES = 5
/** Max results */
const MAX_RESULTS = 40

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? 'all'
  const sort = (searchParams.get('sort') ?? 'underrated') as 'underrated' | 'score' | 'activity'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), MAX_RESULTS)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  // ── 1. Pull scored arguments ───────────────────────────────────────────────
  // Grab topic_id, ai_score, side for all scored arguments
  const { data: scoredArgs, error: argsErr } = await supabase
    .from('topic_arguments')
    .select('topic_id, ai_score, side')
    .not('ai_score', 'is', null)
    .gte('ai_score', 5)
    .limit(50000)

  if (argsErr) {
    return NextResponse.json({ error: 'arguments_fetch' }, { status: 500 })
  }

  // ── 2. Aggregate per topic ─────────────────────────────────────────────────
  const topicArgMap: Record<
    string,
    { total_score: number; count: number; for_count: number; against_count: number }
  > = {}

  for (const arg of scoredArgs ?? []) {
    if (!arg.topic_id || arg.ai_score == null) continue
    const entry = topicArgMap[arg.topic_id] ?? {
      total_score: 0, count: 0, for_count: 0, against_count: 0,
    }
    entry.total_score += arg.ai_score
    entry.count += 1
    if (arg.side === 'blue') entry.for_count += 1
    else entry.against_count += 1
    topicArgMap[arg.topic_id] = entry
  }

  // Filter to topics meeting minimum thresholds
  const qualifyingIds = Object.entries(topicArgMap)
    .filter(([, stats]) => {
      const avg = stats.total_score / stats.count
      return stats.count >= MIN_SCORED_ARGS && avg >= MIN_AVG_SCORE
    })
    .map(([id]) => id)

  if (qualifyingIds.length === 0) {
    return NextResponse.json({
      topics: [],
      total: 0,
      categories: CATEGORIES,
    } satisfies UnderratedTopicsResponse)
  }

  // ── 3. Fetch topic details for qualifying IDs ──────────────────────────────
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, created_at')
    .in('id', qualifyingIds.slice(0, 500))
    .in('status', ['proposed', 'active', 'voting'])
    .gte('total_votes', MIN_VOTES)
    .lte('total_votes', MAX_VOTES)

  if (category !== 'all' && CATEGORIES.includes(category)) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicRows, error: topicErr } = await topicsQuery

  if (topicErr) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  // ── 4. Also get total argument count per topic (scored + unscored) ─────────
  const topicIds = (topicRows ?? []).map((t) => t.id)
  let totalArgCounts: Record<string, number> = {}

  if (topicIds.length > 0) {
    const { data: allArgs } = await supabase
      .from('topic_arguments')
      .select('topic_id')
      .in('topic_id', topicIds)
      .limit(100000)

    for (const arg of allArgs ?? []) {
      totalArgCounts[arg.topic_id] = (totalArgCounts[arg.topic_id] ?? 0) + 1
    }
  }

  // ── 5. Compute underrated score and build result ───────────────────────────
  const results: UnderratedTopic[] = (topicRows ?? []).map((topic) => {
    const stats = topicArgMap[topic.id]!
    const avg_ai_score = stats.total_score / stats.count
    const scored_arg_count = stats.count
    const total_arg_count = totalArgCounts[topic.id] ?? scored_arg_count
    const total_votes = topic.total_votes ?? MIN_VOTES

    // underrated_score: high quality + many good args, low votes = high score
    const underrated_score =
      (avg_ai_score * Math.sqrt(scored_arg_count)) / Math.log2(total_votes + 2)

    const forRatio = stats.for_count / stats.count
    const argument_balance: 'for' | 'against' | 'balanced' =
      forRatio >= 0.65 ? 'for' : forRatio <= 0.35 ? 'against' : 'balanced'

    return {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: Math.round(topic.blue_pct ?? 50),
      total_votes,
      scope: topic.scope,
      created_at: topic.created_at,
      avg_ai_score: Math.round(avg_ai_score * 10) / 10,
      scored_arg_count,
      total_arg_count,
      underrated_score: Math.round(underrated_score * 100) / 100,
      argument_balance,
    }
  })

  // ── 6. Sort ────────────────────────────────────────────────────────────────
  if (sort === 'score') {
    results.sort((a, b) => b.avg_ai_score - a.avg_ai_score)
  } else if (sort === 'activity') {
    results.sort((a, b) => b.total_arg_count - a.total_arg_count)
  } else {
    results.sort((a, b) => b.underrated_score - a.underrated_score)
  }

  const paginated = results.slice(offset, offset + limit)

  return NextResponse.json({
    topics: paginated,
    total: results.length,
    categories: CATEGORIES,
  } satisfies UnderratedTopicsResponse)
}
