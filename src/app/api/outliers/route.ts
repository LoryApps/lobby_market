import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ParadoxType = 'quality_inversion' | 'expert_outlier' | 'majority_dissent'

export interface OutlierTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string

  // Per-side argument stats
  for_arg_count: number
  against_arg_count: number
  for_avg_ai_score: number | null
  against_avg_ai_score: number | null
  for_avg_upvotes: number
  against_avg_upvotes: number

  // Which side is winning the vote
  vote_winner: 'for' | 'against' | 'tied'
  // Which side has better arguments
  quality_winner: 'for' | 'against' | 'tied' | 'unknown'

  // Magnitude of the vote lead (0–50)
  vote_margin: number
  // Magnitude of the quality gap (0–9)
  quality_gap: number | null

  // Combined paradox score (0–100): higher = more paradoxical
  paradox_score: number
  paradox_type: ParadoxType

  // Human-readable description of the paradox
  paradox_label: string
}

export interface OutliersResponse {
  topics: OutlierTopic[]
  total: number
  category_filter: string | null
  min_args: number
}

// ─── GET /api/outliers ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category')?.trim() ?? ''
  const rawSort = searchParams.get('sort') ?? 'paradox'
  const rawMinArgs = parseInt(searchParams.get('min_args') ?? '3', 10)

  const VALID_CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
    'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null
  const sort = ['paradox', 'votes', 'recent', 'quality_gap'].includes(rawSort) ? rawSort : 'paradox'
  const minArgs = Number.isFinite(rawMinArgs) && rawMinArgs >= 1 ? rawMinArgs : 3

  const supabase = await createClient()

  // ── Step 1: fetch active/voting topics with enough volume ─────────────────

  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 10)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicsRaw, error: topicsError } = await topicsQuery

  if (topicsError || !topicsRaw?.length) {
    return NextResponse.json({ topics: [], total: 0, category_filter: category, min_args: minArgs })
  }

  const topicIds = topicsRaw.map((t) => t.id)

  // ── Step 2: fetch argument stats per topic + side ─────────────────────────

  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('topic_id, side, upvotes, ai_score')
    .in('topic_id', topicIds)

  // Aggregate per (topic, side)
  type SideStats = { scores: number[]; upvotes_sum: number; count: number }
  type TopicArgMap = Record<string, { blue: SideStats; red: SideStats }>
  const argMap: TopicArgMap = {}

  for (const arg of argsRaw ?? []) {
    if (!argMap[arg.topic_id]) {
      argMap[arg.topic_id] = {
        blue: { scores: [], upvotes_sum: 0, count: 0 },
        red: { scores: [], upvotes_sum: 0, count: 0 },
      }
    }
    const side = arg.side === 'blue' ? 'blue' : 'red'
    const stats = argMap[arg.topic_id][side]
    stats.count++
    stats.upvotes_sum += arg.upvotes ?? 0
    if (arg.ai_score != null) stats.scores.push(arg.ai_score)
  }

  // ── Step 3: compute paradox scores ───────────────────────────────────────

  const results: OutlierTopic[] = []

  for (const t of topicsRaw) {
    const blue_pct = typeof t.blue_pct === 'number' ? t.blue_pct : 50
    const total_votes = typeof t.total_votes === 'number' ? t.total_votes : 0

    const sides = argMap[t.id]
    const forStats = sides?.blue ?? { scores: [], upvotes_sum: 0, count: 0 }
    const againstStats = sides?.red ?? { scores: [], upvotes_sum: 0, count: 0 }

    // Skip topics without enough arguments on both sides
    if (forStats.count + againstStats.count < minArgs * 2) continue

    const forAvgScore = forStats.scores.length
      ? forStats.scores.reduce((a, b) => a + b, 0) / forStats.scores.length
      : null
    const againstAvgScore = againstStats.scores.length
      ? againstStats.scores.reduce((a, b) => a + b, 0) / againstStats.scores.length
      : null
    const forAvgUpvotes = forStats.count ? forStats.upvotes_sum / forStats.count : 0
    const againstAvgUpvotes = againstStats.count ? againstStats.upvotes_sum / againstStats.count : 0

    const vote_margin = Math.abs(blue_pct - 50)
    const vote_winner: 'for' | 'against' | 'tied' =
      blue_pct > 52 ? 'for' : blue_pct < 48 ? 'against' : 'tied'

    // Quality winner based on AI scores, fallback to upvotes
    let quality_winner: 'for' | 'against' | 'tied' | 'unknown' = 'unknown'
    let quality_gap: number | null = null

    if (forAvgScore !== null && againstAvgScore !== null) {
      quality_gap = Math.abs(forAvgScore - againstAvgScore)
      if (forAvgScore > againstAvgScore + 0.5) quality_winner = 'for'
      else if (againstAvgScore > forAvgScore + 0.5) quality_winner = 'against'
      else quality_winner = 'tied'
    } else if (forAvgUpvotes !== againstAvgUpvotes) {
      // Fallback: use upvotes as quality proxy
      const upvoteGap = Math.abs(forAvgUpvotes - againstAvgUpvotes)
      if (forAvgUpvotes > againstAvgUpvotes * 1.2) quality_winner = 'for'
      else if (againstAvgUpvotes > forAvgUpvotes * 1.2) quality_winner = 'against'
      else quality_winner = 'tied'
    }

    // Only include topics with a genuine paradox: vote_winner ≠ quality_winner
    const isParadox =
      quality_winner !== 'unknown' &&
      quality_winner !== 'tied' &&
      vote_winner !== 'tied' &&
      vote_winner !== quality_winner

    if (!isParadox) continue
    if (vote_margin < 3) continue // Skip near-ties — too noisy

    // Paradox score (0–100):
    //   vote_margin component (0–50): how dominant is the vote
    //   quality_gap component (0–50): how dominant is the quality reversal
    const voteComponent = Math.min(vote_margin * 1.5, 50)
    const qualityComponent = quality_gap != null ? Math.min(quality_gap * 8, 50) : 20
    const paradox_score = Math.round(voteComponent + qualityComponent)

    // Paradox type
    let paradox_type: ParadoxType = 'quality_inversion'
    let paradox_label = ''

    if (quality_winner === 'against' && vote_winner === 'for') {
      paradox_type = 'quality_inversion'
      paradox_label = `The FOR side is winning the vote (+${vote_margin.toFixed(0)}pp) despite AGAINST arguments scoring higher in quality`
    } else if (quality_winner === 'for' && vote_winner === 'against') {
      paradox_type = 'quality_inversion'
      paradox_label = `The AGAINST side is winning the vote (+${vote_margin.toFixed(0)}pp) despite FOR arguments scoring higher in quality`
    } else {
      paradox_type = 'majority_dissent'
      paradox_label = `Community vote and argument quality point in opposite directions`
    }

    results.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      blue_pct,
      total_votes,
      created_at: t.created_at,
      for_arg_count: forStats.count,
      against_arg_count: againstStats.count,
      for_avg_ai_score: forAvgScore,
      against_avg_ai_score: againstAvgScore,
      for_avg_upvotes: forAvgUpvotes,
      against_avg_upvotes: againstAvgUpvotes,
      vote_winner,
      quality_winner,
      vote_margin,
      quality_gap,
      paradox_score,
      paradox_type,
      paradox_label,
    })
  }

  // ── Step 4: sort ──────────────────────────────────────────────────────────

  if (sort === 'paradox') results.sort((a, b) => b.paradox_score - a.paradox_score)
  else if (sort === 'votes') results.sort((a, b) => b.total_votes - a.total_votes)
  else if (sort === 'recent') results.sort((a, b) => b.created_at.localeCompare(a.created_at))
  else if (sort === 'quality_gap') {
    results.sort((a, b) => (b.quality_gap ?? 0) - (a.quality_gap ?? 0))
  }

  return NextResponse.json({
    topics: results.slice(0, 50),
    total: results.length,
    category_filter: category,
    min_args: minArgs,
  } satisfies OutliersResponse)
}
