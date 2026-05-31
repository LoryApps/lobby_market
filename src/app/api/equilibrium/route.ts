import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EquilibriumTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  for_args: number
  against_args: number
  // Equilibrium dimensions
  consensus_strength: number   // 0–1: how far from 50/50
  volume_weight: number        // 0–1: log-scaled vote volume
  status_maturity: number      // 0–1: proposal stage completeness
  argument_resolution: number  // 0–1: arg-weighted consensus
  // Composite
  equilibrium_score: number    // 0–100
  tier: EquilibriumTier
}

export type EquilibriumTier =
  | 'settled'     // score >= 75: clear community verdict
  | 'converging'  // score 50–74: trending toward resolution
  | 'contested'   // score 25–49: still actively debated
  | 'undecided'   // score < 25: too close to call / too few votes

export interface CategoryEquilibrium {
  category: string
  topic_count: number
  avg_score: number
  settled_pct: number
  most_settled: string | null
  most_contested: string | null
}

export interface EquilibriumStats {
  platform_score: number        // overall 0–100
  settled_count: number
  converging_count: number
  contested_count: number
  undecided_count: number
  total_topics: number
  most_settled_category: string | null
  most_contested_category: string | null
  law_avg_score: number
  active_avg_score: number
}

export interface EquilibriumResponse {
  topics: EquilibriumTopic[]
  categories: CategoryEquilibrium[]
  stats: EquilibriumStats
  generatedAt: string
}

// ─── Score calculation ────────────────────────────────────────────────────────

const STATUS_MATURITY: Record<string, number> = {
  law: 1.0,
  failed: 0.9,
  voting: 0.7,
  active: 0.4,
  proposed: 0.1,
  continued: 0.5,
  archived: 0.85,
}

function computeEquilibriumScore(t: {
  blue_pct: number
  total_votes: number
  status: string
  for_args: number
  against_args: number
}): {
  score: number
  consensus_strength: number
  volume_weight: number
  status_maturity: number
  argument_resolution: number
} {
  // 1. Consensus strength: how far from 50/50 (0 = deadlock, 1 = unanimous)
  const distFrom50 = Math.abs(t.blue_pct - 50)
  const consensus_strength = distFrom50 / 50

  // 2. Volume weight: log-scaled (need enough votes to trust the result)
  // 100 votes = 0.5, 1000 = 0.75, 10000 = 1.0
  const volume_weight = Math.min(1, Math.log10(Math.max(t.total_votes, 1)) / 4)

  // 3. Status maturity: how far through the civic pipeline
  const status_maturity = STATUS_MATURITY[t.status] ?? 0.3

  // 4. Argument resolution: is argument volume also skewed in the same direction?
  const totalArgs = (t.for_args ?? 0) + (t.against_args ?? 0)
  let argument_resolution = 0.5 // neutral if no args
  if (totalArgs > 0) {
    const argForPct = ((t.for_args ?? 0) / totalArgs) * 100
    const argDistFrom50 = Math.abs(argForPct - 50)
    // Check if args lean the same way as votes
    const sameDirection =
      (t.blue_pct >= 50 && argForPct >= 50) ||
      (t.blue_pct < 50 && argForPct < 50)
    argument_resolution = sameDirection
      ? 0.5 + argDistFrom50 / 100
      : 0.5 - argDistFrom50 / 100
    argument_resolution = Math.max(0, Math.min(1, argument_resolution))
  }

  // Weighted composite (weights sum to 1)
  const score =
    consensus_strength * 0.45 +
    volume_weight * 0.30 +
    status_maturity * 0.15 +
    argument_resolution * 0.10

  return {
    score: Math.round(score * 100),
    consensus_strength,
    volume_weight,
    status_maturity,
    argument_resolution,
  }
}

function scoreTier(score: number): EquilibriumTier {
  if (score >= 75) return 'settled'
  if (score >= 50) return 'converging'
  if (score >= 25) return 'contested'
  return 'undecided'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch active/voted topics (exclude pure stubs with 0 votes)
  const { data: rawTopics, error } = await supabase
    .from('topics')
    .select(`
      id,
      statement,
      category,
      status,
      total_votes,
      blue_pct,
      for_args:topic_arguments!left(count)
    `)
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed', 'continued', 'archived'])
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch argument counts separately (for/against)
  const topicIds = (rawTopics ?? []).map((t) => t.id)
  const argCounts: Record<string, { for_args: number; against_args: number }> = {}

  if (topicIds.length > 0) {
    const { data: argData } = await supabase
      .from('topic_arguments')
      .select('topic_id, side')
      .in('topic_id', topicIds)

    if (argData) {
      for (const arg of argData) {
        if (!argCounts[arg.topic_id]) {
          argCounts[arg.topic_id] = { for_args: 0, against_args: 0 }
        }
        if (arg.side === 'blue') argCounts[arg.topic_id].for_args++
        else argCounts[arg.topic_id].against_args++
      }
    }
  }

  // Score topics
  const topics: EquilibriumTopic[] = (rawTopics ?? []).map((t) => {
    const args = argCounts[t.id] ?? { for_args: 0, against_args: 0 }
    const dims = computeEquilibriumScore({
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      status: t.status,
      for_args: args.for_args,
      against_args: args.against_args,
    })
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes ?? 0,
      blue_pct: t.blue_pct ?? 50,
      for_args: args.for_args,
      against_args: args.against_args,
      consensus_strength: dims.consensus_strength,
      volume_weight: dims.volume_weight,
      status_maturity: dims.status_maturity,
      argument_resolution: dims.argument_resolution,
      equilibrium_score: dims.score,
      tier: scoreTier(dims.score),
    }
  })

  // Sort by score desc for "most settled" display
  topics.sort((a, b) => b.equilibrium_score - a.equilibrium_score)

  // Category stats
  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const categories: CategoryEquilibrium[] = []
  for (const cat of CATEGORIES) {
    const catTopics = topics.filter((t) => t.category === cat)
    if (catTopics.length === 0) continue
    const avgScore = catTopics.reduce((s, t) => s + t.equilibrium_score, 0) / catTopics.length
    const settledCount = catTopics.filter((t) => t.tier === 'settled').length
    const sorted = [...catTopics].sort((a, b) => b.equilibrium_score - a.equilibrium_score)
    categories.push({
      category: cat,
      topic_count: catTopics.length,
      avg_score: Math.round(avgScore),
      settled_pct: Math.round((settledCount / catTopics.length) * 100),
      most_settled: sorted[0]?.statement.slice(0, 60) ?? null,
      most_contested: sorted[sorted.length - 1]?.statement.slice(0, 60) ?? null,
    })
  }
  categories.sort((a, b) => b.avg_score - a.avg_score)

  // Platform stats
  const settled = topics.filter((t) => t.tier === 'settled')
  const converging = topics.filter((t) => t.tier === 'converging')
  const contested = topics.filter((t) => t.tier === 'contested')
  const undecided = topics.filter((t) => t.tier === 'undecided')

  const laws = topics.filter((t) => t.status === 'law')
  const active = topics.filter((t) => t.status === 'active')

  const platformScore = topics.length > 0
    ? Math.round(topics.reduce((s, t) => s + t.equilibrium_score, 0) / topics.length)
    : 0

  const stats: EquilibriumStats = {
    platform_score: platformScore,
    settled_count: settled.length,
    converging_count: converging.length,
    contested_count: contested.length,
    undecided_count: undecided.length,
    total_topics: topics.length,
    most_settled_category: categories[0]?.category ?? null,
    most_contested_category: categories[categories.length - 1]?.category ?? null,
    law_avg_score: laws.length > 0
      ? Math.round(laws.reduce((s, t) => s + t.equilibrium_score, 0) / laws.length)
      : 0,
    active_avg_score: active.length > 0
      ? Math.round(active.reduce((s, t) => s + t.equilibrium_score, 0) / active.length)
      : 0,
  }

  const response: EquilibriumResponse = {
    topics,
    categories,
    stats,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
