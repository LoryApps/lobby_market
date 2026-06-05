import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FractureTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  argument_count: number
  blue_arg_count: number
  red_arg_count: number
  vote_balance: number
  arg_balance: number
  fracture_score: number
  rank: number
}

export interface FractureStats {
  topics_analyzed: number
  most_fractured_category: string | null
  avg_split: number
  perfect_splits: number
  category_breakdown: Array<{
    category: string
    count: number
    avg_fracture: number
    avg_split: number
  }>
}

export interface FractureResponse {
  fractures: FractureTopic[]
  stats: FractureStats
  updated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '30', 10)))
  const category = searchParams.get('category') ?? null
  const minVotes = parseInt(searchParams.get('min_votes') ?? '10', 10)

  const supabase = await createClient()

  // ── Fetch topics with meaningful vote counts ──────────────────────────────
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, view_count, created_at')
    .gte('total_votes', minVotes)
    .not('blue_pct', 'is', null)
    .in('status', ['active', 'voting', 'proposed', 'law'])
    .limit(1000)

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicsRaw, error: topicsErr } = await topicsQuery

  if (topicsErr) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  const topics = topicsRaw ?? []

  if (topics.length === 0) {
    return NextResponse.json({
      fractures: [],
      stats: {
        topics_analyzed: 0,
        most_fractured_category: null,
        avg_split: 50,
        perfect_splits: 0,
        category_breakdown: [],
      },
      updated_at: new Date().toISOString(),
    } satisfies FractureResponse)
  }

  // ── Fetch argument counts split by side ───────────────────────────────────
  const topicIds = topics.map((t) => t.id)
  const { data: argsRaw } = await supabase
    .from('arguments')
    .select('topic_id, side')
    .in('topic_id', topicIds)

  const argMap = new Map<string, { blue: number; red: number }>()
  for (const a of argsRaw ?? []) {
    if (!argMap.has(a.topic_id)) argMap.set(a.topic_id, { blue: 0, red: 0 })
    const entry = argMap.get(a.topic_id)!
    if (a.side === 'blue') entry.blue++
    else if (a.side === 'red') entry.red++
  }

  // ── Compute fracture scores ───────────────────────────────────────────────
  // vote_balance: 1 = perfect 50/50, 0 = unanimous
  // arg_balance: 1 = equal args on both sides, 0 = only one side arguing
  // fracture_score = vote_balance * log(votes+1) * (0.6 + 0.4 * arg_balance)
  const scored = topics.map((t) => {
    const bluePct = t.blue_pct ?? 50
    const votes = t.total_votes ?? 0
    const votes_log = Math.log10(votes + 1)

    const vote_balance = 1 - Math.abs(bluePct - 50) / 50

    const args = argMap.get(t.id) ?? { blue: 0, red: 0 }
    const totalArgs = args.blue + args.red
    const arg_balance =
      totalArgs === 0
        ? 0.5
        : Math.min(args.blue, args.red) / Math.max(args.blue, args.red, 1)

    const fracture_score = vote_balance * votes_log * (0.6 + 0.4 * arg_balance)

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope ?? null,
      blue_pct: bluePct,
      total_votes: votes,
      view_count: t.view_count ?? 0,
      created_at: t.created_at,
      argument_count: totalArgs,
      blue_arg_count: args.blue,
      red_arg_count: args.red,
      vote_balance: Math.round(vote_balance * 1000) / 1000,
      arg_balance: Math.round(arg_balance * 1000) / 1000,
      fracture_score: Math.round(fracture_score * 1000) / 1000,
      rank: 0,
    }
  })

  // Sort by fracture_score descending
  scored.sort((a, b) => b.fracture_score - a.fracture_score)
  const topN = scored.slice(0, limit).map((t, i) => ({ ...t, rank: i + 1 }))

  // ── Stats ─────────────────────────────────────────────────────────────────
  const catMap = new Map<string, { count: number; totalFracture: number; totalBalance: number }>()
  for (const t of scored) {
    const cat = t.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { count: 0, totalFracture: 0, totalBalance: 0 })
    const c = catMap.get(cat)!
    c.count++
    c.totalFracture += t.fracture_score
    c.totalBalance += t.vote_balance
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([cat, { count, totalFracture, totalBalance }]) => ({
      category: cat,
      count,
      avg_fracture: Math.round((totalFracture / count) * 100) / 100,
      avg_split: Math.round((totalBalance / count) * 100) / 100,
    }))
    .sort((a, b) => b.avg_fracture - a.avg_fracture)

  const avgSplit =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, t) => sum + Math.abs(t.blue_pct - 50), 0) / scored.length) * 10,
        ) / 10
      : 0

  const perfectSplits = scored.filter((t) => Math.abs(t.blue_pct - 50) < 5).length

  return NextResponse.json({
    fractures: topN,
    stats: {
      topics_analyzed: topics.length,
      most_fractured_category: categoryBreakdown[0]?.category ?? null,
      avg_split: avgSplit,
      perfect_splits: perfectSplits,
      category_breakdown: categoryBreakdown,
    },
    updated_at: new Date().toISOString(),
  } satisfies FractureResponse)
}
