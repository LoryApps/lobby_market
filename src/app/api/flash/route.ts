import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlashTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  // Vote direction (cumulative)
  blue_pct: number
  total_votes: number
  // Argument direction (upvote-weighted)
  arg_blue_pct: number
  total_arg_upvotes: number
  blue_arg_upvotes: number
  red_arg_upvotes: number
  total_arguments: number
  // Flash metrics
  flash_score: number       // 0–100: how much vote vs. arg direction diverges
  vote_side: 'blue' | 'red' // dominant vote direction
  arg_side: 'blue' | 'red'  // dominant argument direction
  tension_type: 'vote_for_arg_against' | 'vote_against_arg_for'
  // Recency signals
  last_argument_at: string | null
  view_count: number
  created_at: string
}

export interface FlashStats {
  total_flashpoints: number
  avg_flash_score: number
  highest_flash_score: number
  top_category: string | null
  vote_for_arg_against_count: number
  vote_against_arg_for_count: number
}

export interface FlashResponse {
  flashpoints: FlashTopic[]
  stats: FlashStats
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Fetch active/voting topics with enough data to compute a flash score
  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, view_count, total_arguments, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 30)
    .gte('total_arguments', 4)
    .order('total_votes', { ascending: false })
    .limit(300)

  if (topicsErr || !topics || topics.length === 0) {
    const empty: FlashResponse = {
      flashpoints: [],
      stats: {
        total_flashpoints: 0,
        avg_flash_score: 0,
        highest_flash_score: 0,
        top_category: null,
        vote_for_arg_against_count: 0,
        vote_against_arg_for_count: 0,
      },
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty, {
      headers: { 'Cache-Control': 's-maxage=180, stale-while-revalidate=60' },
    })
  }

  const topicIds = topics.map((t) => t.id)

  // 2. Fetch all arguments for these topics with upvote totals
  const { data: args } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, side, upvotes, created_at')
    .in('topic_id', topicIds)
    .order('created_at', { ascending: false })

  // 3. Aggregate argument upvotes per topic per side
  const argMap: Record<string, { blue: number; red: number; total: number; last_at: string | null }> = {}

  for (const a of args ?? []) {
    const tid = a.topic_id as string
    if (!argMap[tid]) argMap[tid] = { blue: 0, red: 0, total: 0, last_at: null }
    const upvotes = (a.upvotes as number) ?? 0
    // Count each argument as at least 1 (its existence), plus its upvotes
    const weight = 1 + upvotes
    if ((a.side as string) === 'blue') argMap[tid].blue += weight
    else argMap[tid].red += weight
    argMap[tid].total += weight
    if (!argMap[tid].last_at || (a.created_at as string) > argMap[tid].last_at!) {
      argMap[tid].last_at = a.created_at as string
    }
  }

  // 4. Compute flash scores
  const enriched: FlashTopic[] = []

  for (const t of topics) {
    const agg = argMap[t.id]
    if (!agg || agg.total === 0) continue

    const vote_blue_pct = t.blue_pct ?? 50
    const arg_blue_pct = Math.round((agg.blue / agg.total) * 100)

    // Flash score = absolute divergence between vote direction and arg direction
    const flash_score = Math.abs(vote_blue_pct - arg_blue_pct)

    // Only include topics with meaningful divergence (≥15 points)
    if (flash_score < 15) continue

    const vote_side: 'blue' | 'red' = vote_blue_pct >= 50 ? 'blue' : 'red'
    const arg_side: 'blue' | 'red' = arg_blue_pct >= 50 ? 'blue' : 'red'

    // Must actually be a cross-direction divergence (different sides dominate)
    if (vote_side === arg_side) continue

    const tension_type: FlashTopic['tension_type'] =
      vote_side === 'blue' ? 'vote_for_arg_against' : 'vote_against_arg_for'

    enriched.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      scope: (t as { scope?: string | null }).scope ?? null,
      blue_pct: vote_blue_pct,
      total_votes: t.total_votes ?? 0,
      arg_blue_pct,
      total_arg_upvotes: agg.total,
      blue_arg_upvotes: agg.blue,
      red_arg_upvotes: agg.red,
      total_arguments: t.total_arguments ?? 0,
      flash_score,
      vote_side,
      arg_side,
      tension_type,
      last_argument_at: agg.last_at,
      view_count: t.view_count ?? 0,
      created_at: t.created_at,
    })
  }

  // 5. Sort by flash score descending
  enriched.sort((a, b) => b.flash_score - a.flash_score)
  const flashpoints = enriched.slice(0, 40)

  // 6. Stats
  const catCounts: Record<string, number> = {}
  for (const f of flashpoints) {
    if (f.category) catCounts[f.category] = (catCounts[f.category] ?? 0) + 1
  }
  const top_category =
    Object.keys(catCounts).length > 0
      ? Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null

  const stats: FlashStats = {
    total_flashpoints: flashpoints.length,
    avg_flash_score:
      flashpoints.length > 0
        ? Math.round(flashpoints.reduce((s, f) => s + f.flash_score, 0) / flashpoints.length)
        : 0,
    highest_flash_score: flashpoints[0]?.flash_score ?? 0,
    top_category,
    vote_for_arg_against_count: flashpoints.filter((f) => f.tension_type === 'vote_for_arg_against').length,
    vote_against_arg_for_count: flashpoints.filter((f) => f.tension_type === 'vote_against_arg_for').length,
  }

  const response: FlashResponse = {
    flashpoints,
    stats,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=180, stale-while-revalidate=60' },
  })
}
