import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersuasionArgument {
  id: string
  content: string
  topic_id: string
  topic_statement: string
  category: string | null
  side: 'blue' | 'red'
  upvotes: number
  topic_total_votes: number
  persuasion_score: number
  created_at: string
}

export interface SideStats {
  count: number
  avg_upvotes: number
  avg_score: number
  total_upvotes: number
}

export interface CategoryPersuasion {
  category: string
  argument_count: number
  total_upvotes: number
  avg_upvotes: number
  avg_score: number
}

export interface MonthlyPersuasion {
  month: string
  count: number
  total_upvotes: number
  avg_score: number
}

export interface PersuasionTip {
  id: string
  title: string
  body: string
  priority: 'high' | 'medium'
}

export interface PersuasionResponse {
  total_arguments: number
  total_upvotes: number
  avg_upvotes_per_argument: number
  avg_persuasion_score: number
  persuasion_tier: string
  persuasion_tier_description: string
  persuasion_tier_color: string
  for_stats: SideStats
  against_stats: SideStats
  stronger_side: 'for' | 'against' | 'balanced'
  top_arguments: PersuasionArgument[]
  by_category: CategoryPersuasion[]
  monthly_trend: MonthlyPersuasion[]
  tips: PersuasionTip[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function persuasionScore(upvotes: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0
  // Normalize upvotes by debate size. Square root dampens outsized large debates.
  const raw = upvotes / Math.sqrt(Math.max(totalVotes, 1))
  // Scale to a 0–100 range (raw ≈ 0–10 for typical debates)
  return Math.min(100, Math.round(raw * 10))
}

function getTier(avgScore: number): {
  tier: string
  description: string
  color: string
} {
  if (avgScore >= 70)
    return {
      tier: 'Elite Persuader',
      description: 'Your arguments consistently outperform expectations relative to debate size — a top-tier civic voice.',
      color: 'text-gold',
    }
  if (avgScore >= 50)
    return {
      tier: 'Strong Persuader',
      description: 'You reliably earn above-average upvotes across debates of all sizes.',
      color: 'text-emerald',
    }
  if (avgScore >= 30)
    return {
      tier: 'Effective Contributor',
      description: 'Your arguments land well in most debates — keep honing your timing and depth.',
      color: 'text-for-400',
    }
  if (avgScore >= 15)
    return {
      tier: 'Developing Voice',
      description: 'You\'re building a presence. Focus on evidence and earlier timing to boost reach.',
      color: 'text-gold',
    }
  return {
    tier: 'Emerging Contributor',
    description: 'Every great persuader starts here. Engage more, listen to upvoted arguments, and experiment.',
    color: 'text-surface-400',
  }
}

function generateTips(
  avgScore: number,
  forStats: SideStats,
  againstStats: SideStats,
  topCat: string | null
): PersuasionTip[] {
  const tips: PersuasionTip[] = []

  if (avgScore < 30) {
    tips.push({
      id: 'post-early',
      title: 'Post early in debates',
      body: 'Arguments posted in the first 20% of a debate\'s life cycle tend to get 2–3× more upvotes because they shape the framing for later readers.',
      priority: 'high',
    })
  }

  const sideDiff = Math.abs((forStats.avg_upvotes || 0) - (againstStats.avg_upvotes || 0))
  if (sideDiff > 3 && (forStats.count > 2 || againstStats.count > 2)) {
    const weakSide = (forStats.avg_upvotes || 0) < (againstStats.avg_upvotes || 0) ? 'FOR' : 'AGAINST'
    tips.push({
      id: 'side-balance',
      title: `Strengthen your ${weakSide} arguments`,
      body: `Your ${weakSide === 'FOR' ? 'AGAINST' : 'FOR'} arguments earn significantly more upvotes. Try applying the same structure and depth to ${weakSide} arguments to balance your persuasion range.`,
      priority: 'high',
    })
  }

  if (avgScore >= 30 && avgScore < 60) {
    tips.push({
      id: 'use-data',
      title: 'Ground claims in concrete data',
      body: 'Top-performing arguments cite specific numbers, studies, or examples rather than speaking in generalities. Add a single concrete fact to raise upvotes by an average of 40%.',
      priority: 'medium',
    })
  }

  if (topCat) {
    tips.push({
      id: 'specialize',
      title: `${topCat} is your strongest arena`,
      body: `You earn your highest persuasion scores in ${topCat} debates. Prioritise these topics when you want maximum impact — your arguments already carry weight here.`,
      priority: 'medium',
    })
  }

  if (avgScore >= 60) {
    tips.push({
      id: 'mentor',
      title: 'Consider mentoring newer arguers',
      body: 'Your persuasion track record puts you in the top tier. Upvoting and replying to strong arguments from newer members boosts the whole platform\'s discourse quality.',
      priority: 'medium',
    })
  }

  tips.push({
    id: 'reply-engagement',
    title: 'Engage with replies to your arguments',
    body: 'When you reply back to comments on your arguments, the thread gets more visible — driving more upvotes and stronger community signals.',
    priority: 'medium',
  })

  return tips.slice(0, 4)
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

  // Fetch the user's arguments joined with topic data
  const { data: rawArgs, error } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      topic_id,
      side,
      upvotes,
      created_at,
      topics (
        statement,
        category,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const args = (rawArgs ?? []) as Array<{
    id: string
    content: string
    topic_id: string
    side: string
    upvotes: number
    created_at: string
    topics: { statement: string; category: string | null; total_votes: number } | null
  }>

  if (args.length === 0) {
    const empty: PersuasionResponse = {
      total_arguments: 0,
      total_upvotes: 0,
      avg_upvotes_per_argument: 0,
      avg_persuasion_score: 0,
      persuasion_tier: 'Emerging Contributor',
      persuasion_tier_description: 'Post your first arguments to start building your persuasion profile.',
      persuasion_tier_color: 'text-surface-400',
      for_stats: { count: 0, avg_upvotes: 0, avg_score: 0, total_upvotes: 0 },
      against_stats: { count: 0, avg_upvotes: 0, avg_score: 0, total_upvotes: 0 },
      stronger_side: 'balanced',
      top_arguments: [],
      by_category: [],
      monthly_trend: [],
      tips: [],
    }
    return NextResponse.json(empty)
  }

  // Enrich with persuasion scores
  const enriched: PersuasionArgument[] = args.map((a) => ({
    id: a.id,
    content: a.content,
    topic_id: a.topic_id,
    topic_statement: a.topics?.statement ?? 'Unknown topic',
    category: a.topics?.category ?? null,
    side: a.side as 'blue' | 'red',
    upvotes: a.upvotes,
    topic_total_votes: a.topics?.total_votes ?? 0,
    persuasion_score: persuasionScore(a.upvotes, a.topics?.total_votes ?? 0),
    created_at: a.created_at,
  }))

  // ── Aggregate stats ────────────────────────────────────────────────────────

  const totalUpvotes = enriched.reduce((s, a) => s + a.upvotes, 0)
  const avgUpvotes = totalUpvotes / enriched.length
  const avgScore =
    enriched.reduce((s, a) => s + a.persuasion_score, 0) / enriched.length

  // ── Side stats ─────────────────────────────────────────────────────────────

  const forArgs = enriched.filter((a) => a.side === 'blue')
  const againstArgs = enriched.filter((a) => a.side === 'red')

  function sideStats(list: PersuasionArgument[]): SideStats {
    if (list.length === 0) return { count: 0, avg_upvotes: 0, avg_score: 0, total_upvotes: 0 }
    const total = list.reduce((s, a) => s + a.upvotes, 0)
    const scoreTotal = list.reduce((s, a) => s + a.persuasion_score, 0)
    return {
      count: list.length,
      total_upvotes: total,
      avg_upvotes: Math.round((total / list.length) * 10) / 10,
      avg_score: Math.round((scoreTotal / list.length) * 10) / 10,
    }
  }

  const forStats = sideStats(forArgs)
  const againstStats = sideStats(againstArgs)

  let strongerSide: 'for' | 'against' | 'balanced' = 'balanced'
  if (
    forStats.count >= 2 &&
    againstStats.count >= 2 &&
    Math.abs(forStats.avg_score - againstStats.avg_score) > 5
  ) {
    strongerSide = forStats.avg_score > againstStats.avg_score ? 'for' : 'against'
  }

  // ── Top arguments ──────────────────────────────────────────────────────────

  const topArgs = [...enriched]
    .sort((a, b) => b.persuasion_score - a.persuasion_score || b.upvotes - a.upvotes)
    .slice(0, 8)

  // ── Category breakdown ─────────────────────────────────────────────────────

  const catMap = new Map<string, PersuasionArgument[]>()
  for (const a of enriched) {
    const cat = a.category ?? 'Uncategorized'
    if (!catMap.has(cat)) catMap.set(cat, [])
    catMap.get(cat)!.push(a)
  }

  const byCategory: CategoryPersuasion[] = Array.from(catMap.entries())
    .map(([category, list]) => {
      const totalUp = list.reduce((s, a) => s + a.upvotes, 0)
      const scoreSum = list.reduce((s, a) => s + a.persuasion_score, 0)
      return {
        category,
        argument_count: list.length,
        total_upvotes: totalUp,
        avg_upvotes: Math.round((totalUp / list.length) * 10) / 10,
        avg_score: Math.round((scoreSum / list.length) * 10) / 10,
      }
    })
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, 8)

  // ── Monthly trend (last 6 months) ──────────────────────────────────────────

  const monthMap = new Map<string, PersuasionArgument[]>()
  for (const a of enriched) {
    const month = a.created_at.slice(0, 7) // "YYYY-MM"
    if (!monthMap.has(month)) monthMap.set(month, [])
    monthMap.get(month)!.push(a)
  }

  const monthlyTrend: MonthlyPersuasion[] = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, list]) => ({
      month,
      count: list.length,
      total_upvotes: list.reduce((s, a) => s + a.upvotes, 0),
      avg_score: Math.round(
        (list.reduce((s, a) => s + a.persuasion_score, 0) / list.length) * 10
      ) / 10,
    }))

  // ── Tips ───────────────────────────────────────────────────────────────────

  const topCat =
    byCategory.length > 0 && byCategory[0].argument_count >= 2
      ? byCategory[0].category
      : null

  const tierInfo = getTier(avgScore)
  const tips = generateTips(avgScore, forStats, againstStats, topCat)

  const response: PersuasionResponse = {
    total_arguments: enriched.length,
    total_upvotes: totalUpvotes,
    avg_upvotes_per_argument: Math.round(avgUpvotes * 10) / 10,
    avg_persuasion_score: Math.round(avgScore * 10) / 10,
    persuasion_tier: tierInfo.tier,
    persuasion_tier_description: tierInfo.description,
    persuasion_tier_color: tierInfo.color,
    for_stats: forStats,
    against_stats: againstStats,
    stronger_side: strongerSide,
    top_arguments: topArgs,
    by_category: byCategory,
    monthly_trend: monthlyTrend,
    tips,
  }

  return NextResponse.json(response)
}
