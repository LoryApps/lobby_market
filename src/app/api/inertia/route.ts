import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type InertiaTier =
  | 'bedrock'     // score ≥ 80: immovable, strongest civic consensus
  | 'granite'     // score 60–79: very high inertia, well-established position
  | 'stone'       // score 40–59: moderate inertia, stable but arguable
  | 'clay'        // score 20–39: some inertia, open to shifting
  | 'sand'        // score < 20: low inertia, still forming or genuinely contested

export interface InertiaTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  /** pp distance from 50 (0 = deadlock, 50 = unanimous) */
  consensus_gap: number
  /** total arguments + replies lodged against this topic */
  total_arguments: number
  /** unique users who have argued */
  unique_arguers: number
  /**
   * Inertia score (0–100):
   *   consensus_weight (how far from 50/50) × engagement_depth (log of votes + args)
   *
   *   consensus_weight = (|blue_pct − 50| / 50)²     — squared to reward extremes
   *   engagement_depth = log10(votes + args × 3 + 1) / log10(MAX_DEPTH)
   *   inertia_score    = consensus_weight × engagement_depth × 100
   *
   * Interpretation: Topics with high inertia have BOTH strong consensus AND
   * high engagement — they absorbed many arguments without budging.
   */
  inertia_score: number
  tier: InertiaTier
  /** Ratio: arguments per 1 pp of consensus gap — "resistance factor" */
  resistance_factor: number
}

export interface CategoryInertia {
  category: string
  topic_count: number
  avg_score: number
  bedrock_count: number
  sand_count: number
  strongest: string | null
  most_contested: string | null
}

export interface InertiaStats {
  platform_score: number
  total_topics: number
  bedrock_count: number
  granite_count: number
  stone_count: number
  clay_count: number
  sand_count: number
  avg_consensus_gap: number
  avg_resistance_factor: number
  most_resistant_category: string | null
}

export interface InertiaResponse {
  topics: InertiaTopic[]
  categories: CategoryInertia[]
  stats: InertiaStats
  generatedAt: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_VOTES = 15
const MAX_RESULTS = 200
const DEFAULT_LIMIT = 30
// Upper bound for depth normalisation (votes + args*3)
const MAX_DEPTH_LOG = Math.log10(100_000)

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Score helpers ────────────────────────────────────────────────────────────

function computeInertia(
  bluePct: number,
  totalVotes: number,
  argCount: number,
): number {
  const gap = Math.abs(bluePct - 50) / 50           // 0 (tied) → 1 (unanimous)
  const consensusWeight = gap * gap                  // squared — rewards extremes
  const depth = totalVotes + argCount * 3 + 1
  const engagementDepth = Math.log10(depth) / MAX_DEPTH_LOG
  return Math.min(100, Math.round(consensusWeight * engagementDepth * 100))
}

function toTier(score: number): InertiaTier {
  if (score >= 80) return 'bedrock'
  if (score >= 60) return 'granite'
  if (score >= 40) return 'stone'
  if (score >= 20) return 'clay'
  return 'sand'
}

// ─── GET /api/inertia ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') ?? null
  const sort = (searchParams.get('sort') ?? 'inertia') as
    | 'inertia'
    | 'consensus'
    | 'resistance'
    | 'engagement'
  const limit = Math.min(
    parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10),
    MAX_RESULTS,
  )

  const supabase = await createClient()

  // ── 1. Fetch topics ───────────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .gte('total_votes', MIN_VOTES)
    .order('total_votes', { ascending: false })
    .limit(MAX_RESULTS)

  if (category) query = query.eq('category', category)

  const { data: topicsRaw, error } = await query

  if (error || !topicsRaw?.length) {
    return NextResponse.json({
      topics: [],
      categories: [],
      stats: {
        platform_score: 0, total_topics: 0,
        bedrock_count: 0, granite_count: 0, stone_count: 0, clay_count: 0, sand_count: 0,
        avg_consensus_gap: 0, avg_resistance_factor: 0, most_resistant_category: null,
      },
      generatedAt: new Date().toISOString(),
    } satisfies InertiaResponse)
  }

  const topicIds = topicsRaw.map((t) => t.id)

  // ── 2. Fetch argument counts ──────────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('topic_id, user_id')
    .in('topic_id', topicIds)

  const argCountMap: Record<string, number> = {}
  const argUserMap: Record<string, Set<string>> = {}
  for (const a of argRows ?? []) {
    argCountMap[a.topic_id] = (argCountMap[a.topic_id] ?? 0) + 1
    if (!argUserMap[a.topic_id]) argUserMap[a.topic_id] = new Set()
    if (a.user_id) argUserMap[a.topic_id].add(a.user_id)
  }

  // ── 3. Compute scores ─────────────────────────────────────────────────────
  const scored: InertiaTopic[] = topicsRaw.map((t) => {
    const argCount = argCountMap[t.id] ?? 0
    const uniqueArguers = argUserMap[t.id]?.size ?? 0
    const bluePct = t.blue_pct ?? 50
    const consensusGap = Math.abs(bluePct - 50)
    const inertiaScore = computeInertia(bluePct, t.total_votes, argCount)
    const resistanceFactor =
      consensusGap > 0
        ? Math.round((argCount / consensusGap) * 10) / 10
        : argCount

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes,
      blue_pct: bluePct,
      consensus_gap: Math.round(consensusGap * 10) / 10,
      total_arguments: argCount,
      unique_arguers: uniqueArguers,
      inertia_score: inertiaScore,
      tier: toTier(inertiaScore),
      resistance_factor: resistanceFactor,
    }
  })

  // ── 4. Sort ───────────────────────────────────────────────────────────────
  if (sort === 'inertia') {
    scored.sort((a, b) => b.inertia_score - a.inertia_score)
  } else if (sort === 'consensus') {
    scored.sort((a, b) => b.consensus_gap - a.consensus_gap)
  } else if (sort === 'resistance') {
    scored.sort((a, b) => b.resistance_factor - a.resistance_factor)
  } else {
    scored.sort((a, b) => b.total_arguments - a.total_arguments)
  }

  const paginated = scored.slice(0, limit)

  // ── 5. Category rollup ───────────────────────────────────────────────────
  const categoryStats: CategoryInertia[] = []
  for (const cat of CATEGORIES) {
    const catTopics = scored.filter((t) => t.category === cat)
    if (catTopics.length === 0) continue
    const avgScore =
      catTopics.reduce((s, t) => s + t.inertia_score, 0) / catTopics.length
    const sorted = [...catTopics].sort((a, b) => b.inertia_score - a.inertia_score)
    const contested = [...catTopics].sort((a, b) => a.consensus_gap - b.consensus_gap)
    categoryStats.push({
      category: cat,
      topic_count: catTopics.length,
      avg_score: Math.round(avgScore),
      bedrock_count: catTopics.filter((t) => t.tier === 'bedrock').length,
      sand_count: catTopics.filter((t) => t.tier === 'sand').length,
      strongest: sorted[0]?.statement.slice(0, 70) ?? null,
      most_contested: contested[0]?.statement.slice(0, 70) ?? null,
    })
  }
  categoryStats.sort((a, b) => b.avg_score - a.avg_score)

  // ── 6. Platform stats ─────────────────────────────────────────────────────
  const total = scored.length
  const platformScore =
    total > 0
      ? Math.round(scored.reduce((s, t) => s + t.inertia_score, 0) / total)
      : 0
  const avgGap =
    total > 0
      ? Math.round(
          (scored.reduce((s, t) => s + t.consensus_gap, 0) / total) * 10,
        ) / 10
      : 0
  const avgResistance =
    total > 0
      ? Math.round(
          (scored.reduce((s, t) => s + t.resistance_factor, 0) / total) * 10,
        ) / 10
      : 0

  const catByScore = [...categoryStats].sort((a, b) => b.avg_score - a.avg_score)

  const stats: InertiaStats = {
    platform_score: platformScore,
    total_topics: total,
    bedrock_count: scored.filter((t) => t.tier === 'bedrock').length,
    granite_count: scored.filter((t) => t.tier === 'granite').length,
    stone_count: scored.filter((t) => t.tier === 'stone').length,
    clay_count: scored.filter((t) => t.tier === 'clay').length,
    sand_count: scored.filter((t) => t.tier === 'sand').length,
    avg_consensus_gap: avgGap,
    avg_resistance_factor: avgResistance,
    most_resistant_category: catByScore[0]?.category ?? null,
  }

  return NextResponse.json({
    topics: paginated,
    categories: categoryStats,
    stats,
    generatedAt: new Date().toISOString(),
  } satisfies InertiaResponse)
}
