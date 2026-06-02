import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchismTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  // Argument distribution
  blue_arg_count: number
  red_arg_count: number
  total_arg_count: number
  blue_arg_upvotes: number
  red_arg_upvotes: number
  // Top argument on each side
  top_blue_arg: string | null
  top_red_arg: string | null
  // Computed scores
  /** 0–100: closeness to 50/50 */
  polarization: number
  /** 0–100: how evenly arguments are distributed between sides */
  argument_balance: number
  /** 0–100: composite schism score */
  schism_score: number
  /** Qualitative grade */
  grade: 'deep' | 'moderate' | 'emerging' | 'surface'
}

export interface CategorySchism {
  category: string
  topic_count: number
  avg_schism: number
  avg_polarization: number
  dominant_grade: SchismTopic['grade']
  top_topic: SchismTopic | null
}

export interface SchismStats {
  /** 0–100: platform-wide schism index */
  platform_schism_index: number
  /** Topics graded deep */
  deep_count: number
  moderate_count: number
  /** Avg polarization of all schismatic topics */
  avg_polarization: number
  /** % of active topics with significant schism (score ≥ 50) */
  pct_schismatic: number
  total_analyzed: number
  /** Total arguments posted on both sides of top schismatic topics */
  total_contested_arguments: number
}

export interface SchismResponse {
  stats: SchismStats
  top_schismatic: SchismTopic[]
  category_breakdown: CategorySchism[]
  /** Highest argument_balance — fights where both sides argue equally hard */
  most_contested: SchismTopic[]
  /** Most polarized by vote alone (closest to 50/50), moderate argument count */
  vote_splits: SchismTopic[]
  generated_at: string
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function computePolarization(blue_pct: number): number {
  return Math.round((1 - Math.abs(blue_pct - 50) / 50) * 100)
}

function computeArgumentBalance(blue_args: number, red_args: number): number {
  const total = blue_args + red_args
  if (total === 0) return 0
  const imbalance = Math.abs(blue_args - red_args) / total
  return Math.round((1 - imbalance) * 100)
}

function computeArgumentDepth(total_args: number): number {
  return Math.min(100, Math.log10(Math.max(total_args, 1) + 1) * 50)
}

function computeSchismScore(
  polarization: number,
  argument_balance: number,
  total_args: number,
): number {
  const depth = computeArgumentDepth(total_args)
  // Schism requires vote deadlock AND balanced argumentation AND real argument volume
  // Without arguments, it's just a vote split, not a schism
  return Math.round(polarization * 0.4 + argument_balance * 0.3 + depth * 0.3)
}

function grade(schism_score: number, total_args: number): SchismTopic['grade'] {
  if (schism_score >= 75 && total_args >= 4) return 'deep'
  if (schism_score >= 55 && total_args >= 2) return 'moderate'
  if (schism_score >= 35) return 'emerging'
  return 'surface'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch topics with their argument aggregates
  const { data: rawTopics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(400)

  if (topicsErr || !rawTopics) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  if (rawTopics.length === 0) {
    const empty: SchismResponse = {
      stats: {
        platform_schism_index: 0,
        deep_count: 0,
        moderate_count: 0,
        avg_polarization: 0,
        pct_schismatic: 0,
        total_analyzed: 0,
        total_contested_arguments: 0,
      },
      top_schismatic: [],
      category_breakdown: [],
      most_contested: [],
      vote_splits: [],
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  const topicIds = rawTopics.map((t) => t.id)

  // Fetch argument aggregates per topic per side
  const { data: argAggs, error: argErr } = await supabase
    .from('topic_arguments')
    .select('topic_id, side, upvotes, content')
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })

  if (argErr) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  // Aggregate per topic
  const argMap = new Map<string, {
    blue_count: number; red_count: number
    blue_upvotes: number; red_upvotes: number
    top_blue: string | null; top_red: string | null
  }>()

  for (const arg of argAggs ?? []) {
    if (!argMap.has(arg.topic_id)) {
      argMap.set(arg.topic_id, {
        blue_count: 0, red_count: 0,
        blue_upvotes: 0, red_upvotes: 0,
        top_blue: null, top_red: null,
      })
    }
    const entry = argMap.get(arg.topic_id)!
    if (arg.side === 'blue') {
      entry.blue_count++
      entry.blue_upvotes += arg.upvotes ?? 0
      if (!entry.top_blue) entry.top_blue = arg.content
    } else {
      entry.red_count++
      entry.red_upvotes += arg.upvotes ?? 0
      if (!entry.top_red) entry.top_red = arg.content
    }
  }

  const topics: SchismTopic[] = rawTopics.map((t) => {
    const agg = argMap.get(t.id) ?? {
      blue_count: 0, red_count: 0,
      blue_upvotes: 0, red_upvotes: 0,
      top_blue: null, top_red: null,
    }
    const polarization = computePolarization(t.blue_pct ?? 50)
    const argument_balance = computeArgumentBalance(agg.blue_count, agg.red_count)
    const total_args = agg.blue_count + agg.red_count
    const schism_score = computeSchismScore(polarization, argument_balance, total_args)

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      created_at: t.created_at,
      blue_arg_count: agg.blue_count,
      red_arg_count: agg.red_count,
      total_arg_count: total_args,
      blue_arg_upvotes: agg.blue_upvotes,
      red_arg_upvotes: agg.red_upvotes,
      top_blue_arg: agg.top_blue,
      top_red_arg: agg.top_red,
      polarization,
      argument_balance,
      schism_score,
      grade: grade(schism_score, total_args),
    }
  })

  const sorted = [...topics].sort((a, b) => b.schism_score - a.schism_score)

  // Stats
  const total_analyzed = sorted.length
  const deep_count = sorted.filter((t) => t.grade === 'deep').length
  const moderate_count = sorted.filter((t) => t.grade === 'moderate').length
  const schismatic = sorted.filter((t) => t.schism_score >= 50)
  const pct_schismatic = total_analyzed > 0
    ? Math.round((schismatic.length / total_analyzed) * 100)
    : 0
  const avg_polarization = total_analyzed > 0
    ? Math.round(sorted.reduce((s, t) => s + t.polarization, 0) / total_analyzed)
    : 0
  const platform_schism_index = sorted.length > 0
    ? Math.round(sorted.slice(0, 20).reduce((s, t) => s + t.schism_score, 0) / Math.min(20, sorted.length))
    : 0
  const total_contested_arguments = sorted
    .slice(0, 30)
    .reduce((s, t) => s + t.total_arg_count, 0)

  // Category breakdown
  const catMap = new Map<string, SchismTopic[]>()
  for (const t of sorted) {
    const c = t.category ?? 'Uncategorised'
    if (!catMap.has(c)) catMap.set(c, [])
    catMap.get(c)!.push(t)
  }

  const dominantGrade = (ts: SchismTopic[]): SchismTopic['grade'] => {
    const counts = { deep: 0, moderate: 0, emerging: 0, surface: 0 }
    for (const t of ts) counts[t.grade]++
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as SchismTopic['grade'])
  }

  const category_breakdown: CategorySchism[] = Array.from(catMap.entries())
    .map(([category, ts]) => ({
      category,
      topic_count: ts.length,
      avg_schism: Math.round(ts.reduce((s, t) => s + t.schism_score, 0) / ts.length),
      avg_polarization: Math.round(ts.reduce((s, t) => s + t.polarization, 0) / ts.length),
      dominant_grade: dominantGrade(ts),
      top_topic: ts[0] ?? null,
    }))
    .sort((a, b) => b.avg_schism - a.avg_schism)
    .slice(0, 10)

  // Most contested: highest argument_balance (both sides argue equally hard)
  const most_contested = [...sorted]
    .filter((t) => t.total_arg_count >= 2)
    .sort((a, b) => b.argument_balance - a.argument_balance || b.total_arg_count - a.total_arg_count)
    .slice(0, 8)

  // Vote splits: polarization-dominated (near 50/50 by votes, less argument-heavy)
  const vote_splits = [...sorted]
    .sort((a, b) => b.polarization - a.polarization)
    .slice(0, 8)

  return NextResponse.json({
    stats: {
      platform_schism_index,
      deep_count,
      moderate_count,
      avg_polarization,
      pct_schismatic,
      total_analyzed,
      total_contested_arguments,
    },
    top_schismatic: sorted.slice(0, 25),
    category_breakdown,
    most_contested,
    vote_splits,
    generated_at: new Date().toISOString(),
  } satisfies SchismResponse)
}
