import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GravityTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  view_count: number
  arg_count: number
  reply_count: number
  // Gravity dimensions
  discourse_density: number  // args + replies per vote (0–1)
  view_pull: number          // log-scaled view-to-vote ratio (0–1)
  depth_weight: number       // reply-to-argument ratio — how threaded (0–1)
  // Composite
  gravity_score: number      // 0–100
  tier: GravityTier
}

export type GravityTier =
  | 'singularity' // score ≥ 80: extreme argument black hole
  | 'supergiant'  // score 60–79: powerful intellectual pull
  | 'star'        // score 40–59: healthy debate ecosystem
  | 'dwarf'       // score 20–39: mostly votes, few arguments
  | 'void'        // score < 20: silent, no engagement

export interface CategoryGravity {
  category: string
  topic_count: number
  avg_score: number
  singularity_count: number
  void_count: number
  heaviest: string | null   // statement of highest gravity topic
  lightest: string | null   // statement of lowest gravity topic
}

export interface GravityStats {
  platform_score: number       // average gravity 0–100
  total_topics: number
  singularity_count: number
  supergiant_count: number
  star_count: number
  dwarf_count: number
  void_count: number
  heaviest_category: string | null
  lightest_category: string | null
  total_arguments: number
  total_replies: number
  avg_args_per_vote: number    // platform-wide
}

export interface GravityResponse {
  topics: GravityTopic[]
  categories: CategoryGravity[]
  stats: GravityStats
  generatedAt: string
}

// ─── Tier classification ──────────────────────────────────────────────────────

function scoreTier(score: number): GravityTier {
  if (score >= 80) return 'singularity'
  if (score >= 60) return 'supergiant'
  if (score >= 40) return 'star'
  if (score >= 20) return 'dwarf'
  return 'void'
}

// ─── Gravity score calculation ────────────────────────────────────────────────

function computeGravity(t: {
  total_votes: number
  view_count: number
  arg_count: number
  reply_count: number
}): {
  score: number
  discourse_density: number
  view_pull: number
  depth_weight: number
} {
  const votes = Math.max(t.total_votes, 1)
  const views = Math.max(t.view_count, 0)
  const args = t.arg_count ?? 0
  const replies = t.reply_count ?? 0

  // 1. Discourse density: (args + replies × 0.5) per vote
  // Capped at 1: roughly 10 arguments per vote = saturation (very dense debate)
  const rawDensity = (args + replies * 0.5) / votes
  const discourse_density = Math.min(1, rawDensity / 0.1)

  // 2. View pull: how many more views than votes?
  // log-scaled. 10× views = 0.5, 100× = 0.75, 1000× = 1.0
  const viewRatio = views / votes
  const view_pull = Math.min(1, viewRatio > 0 ? Math.log10(viewRatio + 1) / 3 : 0)

  // 3. Depth weight: reply-to-argument ratio. Active threads = deeper debate.
  // 0 replies = 0, 2 replies/arg = 0.5, 5+ replies/arg = 1.0
  const depth_weight = args > 0 ? Math.min(1, (replies / args) / 5) : 0

  // Weighted composite (discourse_density drives it most)
  const rawScore = discourse_density * 0.60 + view_pull * 0.25 + depth_weight * 0.15
  const score = Math.round(Math.min(100, rawScore * 100))

  return {
    score,
    discourse_density: Math.round(discourse_density * 100) / 100,
    view_pull: Math.round(view_pull * 100) / 100,
    depth_weight: Math.round(depth_weight * 100) / 100,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? null
  const sortBy = (searchParams.get('sort') ?? 'gravity') as 'gravity' | 'density' | 'depth' | 'pull'

  const supabase = await createClient()

  // Fetch topics with vote and view data
  const query = supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct, view_count')
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .gte('total_votes', 3)
    .order('total_votes', { ascending: false })
    .limit(500)

  const { data: rawTopics, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topicIds = (rawTopics ?? []).map((t) => t.id)

  if (topicIds.length === 0) {
    const empty: GravityResponse = {
      topics: [],
      categories: [],
      stats: {
        platform_score: 0,
        total_topics: 0,
        singularity_count: 0,
        supergiant_count: 0,
        star_count: 0,
        dwarf_count: 0,
        void_count: 0,
        heaviest_category: null,
        lightest_category: null,
        total_arguments: 0,
        total_replies: 0,
        avg_args_per_vote: 0,
      },
      generatedAt: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  // Fetch argument counts per topic
  const argCountMap: Record<string, number> = {}
  {
    const { data: argData } = await supabase
      .from('topic_arguments')
      .select('topic_id')
      .in('topic_id', topicIds)

    if (argData) {
      for (const row of argData) {
        argCountMap[row.topic_id] = (argCountMap[row.topic_id] ?? 0) + 1
      }
    }
  }

  // Fetch reply counts per topic (argument_replies has topic_id column)
  const replyCountMap: Record<string, number> = {}
  {
    const { data: replyData } = await supabase
      .from('argument_replies')
      .select('topic_id')
      .in('topic_id', topicIds)

    if (replyData) {
      for (const row of replyData) {
        replyCountMap[row.topic_id] = (replyCountMap[row.topic_id] ?? 0) + 1
      }
    }
  }

  // Compute gravity for each topic
  let topics: GravityTopic[] = (rawTopics ?? []).map((t) => {
    const arg_count = argCountMap[t.id] ?? 0
    const reply_count = replyCountMap[t.id] ?? 0

    const dims = computeGravity({
      total_votes: t.total_votes ?? 0,
      view_count: (t as { view_count?: number }).view_count ?? 0,
      arg_count,
      reply_count,
    })

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes ?? 0,
      blue_pct: t.blue_pct ?? 50,
      view_count: (t as { view_count?: number }).view_count ?? 0,
      arg_count,
      reply_count,
      discourse_density: dims.discourse_density,
      view_pull: dims.view_pull,
      depth_weight: dims.depth_weight,
      gravity_score: dims.score,
      tier: scoreTier(dims.score),
    }
  })

  // Filter by category if requested
  if (category) {
    topics = topics.filter((t) => t.category === category)
  }

  // Sort
  switch (sortBy) {
    case 'density':
      topics.sort((a, b) => b.discourse_density - a.discourse_density)
      break
    case 'depth':
      topics.sort((a, b) => b.depth_weight - a.depth_weight)
      break
    case 'pull':
      topics.sort((a, b) => b.view_pull - a.view_pull)
      break
    default:
      topics.sort((a, b) => b.gravity_score - a.gravity_score)
  }

  // Category breakdown (always uses full topic set before category filter)
  const allTopics = (rawTopics ?? []).map((t) => {
    const arg_count = argCountMap[t.id] ?? 0
    const reply_count = replyCountMap[t.id] ?? 0
    const dims = computeGravity({
      total_votes: t.total_votes ?? 0,
      view_count: (t as { view_count?: number }).view_count ?? 0,
      arg_count,
      reply_count,
    })
    return { ...t, arg_count, reply_count, ...dims, tier: scoreTier(dims.score) }
  })

  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const categoryStats: CategoryGravity[] = []
  for (const cat of CATEGORIES) {
    const catTopics = allTopics.filter((t) => t.category === cat)
    if (catTopics.length === 0) continue
    const avgScore = catTopics.reduce((s, t) => s + t.score, 0) / catTopics.length
    const sorted = [...catTopics].sort((a, b) => b.score - a.score)
    categoryStats.push({
      category: cat,
      topic_count: catTopics.length,
      avg_score: Math.round(avgScore),
      singularity_count: catTopics.filter((t) => t.tier === 'singularity').length,
      void_count: catTopics.filter((t) => t.tier === 'void').length,
      heaviest: sorted[0]?.statement.slice(0, 70) ?? null,
      lightest: sorted[sorted.length - 1]?.statement.slice(0, 70) ?? null,
    })
  }
  categoryStats.sort((a, b) => b.avg_score - a.avg_score)

  // Platform stats
  const totalArgs = Object.values(argCountMap).reduce((s, v) => s + v, 0)
  const totalReplies = Object.values(replyCountMap).reduce((s, v) => s + v, 0)
  const totalVotes = allTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0)

  const stats: GravityStats = {
    platform_score: allTopics.length > 0
      ? Math.round(allTopics.reduce((s, t) => s + t.score, 0) / allTopics.length)
      : 0,
    total_topics: allTopics.length,
    singularity_count: allTopics.filter((t) => t.tier === 'singularity').length,
    supergiant_count: allTopics.filter((t) => t.tier === 'supergiant').length,
    star_count: allTopics.filter((t) => t.tier === 'star').length,
    dwarf_count: allTopics.filter((t) => t.tier === 'dwarf').length,
    void_count: allTopics.filter((t) => t.tier === 'void').length,
    heaviest_category: categoryStats[0]?.category ?? null,
    lightest_category: categoryStats[categoryStats.length - 1]?.category ?? null,
    total_arguments: totalArgs,
    total_replies: totalReplies,
    avg_args_per_vote: totalVotes > 0
      ? Math.round((totalArgs / totalVotes) * 1000) / 1000
      : 0,
  }

  const response: GravityResponse = {
    topics: topics.slice(0, 200),
    categories: categoryStats,
    stats,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
