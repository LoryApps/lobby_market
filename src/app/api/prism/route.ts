import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrismArgument {
  id: string
  content: string
  upvotes: number
  author_username: string | null
  author_display_name: string | null
}

export interface PrismTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  blue_arg_count: number
  red_arg_count: number
  total_arg_count: number
  top_for_arg: PrismArgument | null
  top_against_arg: PrismArgument | null
  /** sqrt(blue_args × red_args) × log10(total_votes + 1) */
  prism_score: number
  /** 1 = perfectly balanced argument counts, 0 = entirely one-sided */
  arg_balance: number
  rank: number
}

export interface PrismStats {
  topics_analyzed: number
  bilateral_topics: number
  most_prismatic_category: string | null
  avg_arg_balance: number
  total_arguments: number
  category_breakdown: Array<{
    category: string
    count: number
    avg_prism: number
    avg_balance: number
  }>
}

export interface PrismResponse {
  topics: PrismTopic[]
  stats: PrismStats
  updated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '25', 10)))
  const category = searchParams.get('category') ?? null
  const minArgs = parseInt(searchParams.get('min_args') ?? '3', 10)

  const supabase = await createClient()

  // ── Fetch active topics ───────────────────────────────────────────────────
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, view_count, created_at')
    .in('status', ['active', 'voting', 'proposed', 'law'])
    .gte('total_votes', 5)
    .limit(1500)

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
      topics: [],
      stats: {
        topics_analyzed: 0,
        bilateral_topics: 0,
        most_prismatic_category: null,
        avg_arg_balance: 0,
        total_arguments: 0,
        category_breakdown: [],
      },
      updated_at: new Date().toISOString(),
    } satisfies PrismResponse)
  }

  // ── Fetch arguments with author info ─────────────────────────────────────
  const topicIds = topics.map((t) => t.id)
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, content, side, upvotes, user_id')
    .in('topic_id', topicIds)

  // Build per-topic argument maps
  interface ArgSideEntry {
    count: number
    topArg: { id: string; content: string; upvotes: number; user_id: string } | null
  }
  const blueMap = new Map<string, ArgSideEntry>()
  const redMap  = new Map<string, ArgSideEntry>()

  for (const a of argsRaw ?? []) {
    const map = a.side === 'blue' ? blueMap : redMap
    if (!map.has(a.topic_id)) map.set(a.topic_id, { count: 0, topArg: null })
    const entry = map.get(a.topic_id)!
    entry.count++
    if (!entry.topArg || (a.upvotes ?? 0) > (entry.topArg.upvotes ?? 0)) {
      entry.topArg = { id: a.id, content: a.content ?? '', upvotes: a.upvotes ?? 0, user_id: a.user_id }
    }
  }

  // ── Collect user IDs for author lookup ────────────────────────────────────
  const authorIds = new Set<string>()
  for (const entry of [...blueMap.values(), ...redMap.values()]) {
    if (entry.topArg?.user_id) authorIds.add(entry.topArg.user_id)
  }

  const authorMap = new Map<string, { username: string | null; display_name: string | null }>()
  if (authorIds.size > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', Array.from(authorIds))
    for (const p of profileRows ?? []) {
      authorMap.set(p.id, { username: p.username, display_name: p.display_name })
    }
  }

  // ── Compute prism scores ──────────────────────────────────────────────────
  const scored: PrismTopic[] = []

  for (const t of topics) {
    const blue = blueMap.get(t.id) ?? { count: 0, topArg: null }
    const red  = redMap.get(t.id)  ?? { count: 0, topArg: null }

    const b = blue.count
    const r = red.count

    // Only include topics with arguments on BOTH sides
    if (b < minArgs || r < minArgs) continue

    const votes = t.total_votes ?? 0
    const arg_balance = Math.min(b, r) / Math.max(b, r)
    const prism_score = Math.sqrt(b * r) * Math.log10(votes + 1)

    const buildArg = (entry: ArgSideEntry['topArg']): PrismArgument | null => {
      if (!entry) return null
      const author = authorMap.get(entry.user_id)
      return {
        id: entry.id,
        content: entry.content,
        upvotes: entry.upvotes,
        author_username: author?.username ?? null,
        author_display_name: author?.display_name ?? null,
      }
    }

    scored.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: votes,
      view_count: t.view_count ?? 0,
      created_at: t.created_at,
      blue_arg_count: b,
      red_arg_count: r,
      total_arg_count: b + r,
      top_for_arg: buildArg(blue.topArg),
      top_against_arg: buildArg(red.topArg),
      prism_score: Math.round(prism_score * 1000) / 1000,
      arg_balance: Math.round(arg_balance * 1000) / 1000,
      rank: 0,
    })
  }

  // Sort by prism_score descending
  scored.sort((a, b) => b.prism_score - a.prism_score)
  const topN = scored.slice(0, limit).map((t, i) => ({ ...t, rank: i + 1 }))

  // ── Stats ─────────────────────────────────────────────────────────────────
  const catMap = new Map<string, { count: number; totalPrism: number; totalBalance: number }>()
  for (const t of scored) {
    const cat = t.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { count: 0, totalPrism: 0, totalBalance: 0 })
    const c = catMap.get(cat)!
    c.count++
    c.totalPrism += t.prism_score
    c.totalBalance += t.arg_balance
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([cat, { count, totalPrism, totalBalance }]) => ({
      category: cat,
      count,
      avg_prism: Math.round((totalPrism / count) * 100) / 100,
      avg_balance: Math.round((totalBalance / count) * 100) / 100,
    }))
    .sort((a, b) => b.avg_prism - a.avg_prism)

  const avgArgBalance =
    scored.length > 0
      ? Math.round((scored.reduce((s, t) => s + t.arg_balance, 0) / scored.length) * 100) / 100
      : 0

  const totalArguments = (argsRaw ?? []).length

  return NextResponse.json({
    topics: topN,
    stats: {
      topics_analyzed: topics.length,
      bilateral_topics: scored.length,
      most_prismatic_category: categoryBreakdown[0]?.category ?? null,
      avg_arg_balance: avgArgBalance,
      total_arguments: totalArguments,
      category_breakdown: categoryBreakdown,
    },
    updated_at: new Date().toISOString(),
  } satisfies PrismResponse)
}
