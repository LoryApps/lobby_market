import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawEntry {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  updated_at: string
  argument_count: number
}

export interface LawCategoryStat {
  category: string
  count: number
  avg_margin: number  // avg absolute deviation from 50, higher = more decisive
  avg_votes: number
}

export interface LawMonthlyPoint {
  month: string      // e.g. "Jan 2026"
  month_key: string  // "2026-01" for sorting
  count: number
}

export interface LawAnalyticsResponse {
  total_laws: number
  laws_this_month: number
  laws_this_week: number
  avg_for_pct: number         // avg FOR% across all laws
  decisive_count: number      // blue_pct >= 65 or <= 35
  competitive_count: number   // 55-65% or 35-45%
  close_count: number         // 45-55%
  category_breakdown: LawCategoryStat[]
  monthly_timeline: LawMonthlyPoint[]
  top_by_arguments: LawEntry[]
  top_by_votes: LawEntry[]
  recent_laws: LawEntry[]
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Fetch all established laws
  const { data: laws, error } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, view_count, updated_at')
    .eq('status', 'law')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allLaws = laws ?? []

  if (allLaws.length === 0) {
    const empty: LawAnalyticsResponse = {
      total_laws: 0,
      laws_this_month: 0,
      laws_this_week: 0,
      avg_for_pct: 0,
      decisive_count: 0,
      competitive_count: 0,
      close_count: 0,
      category_breakdown: [],
      monthly_timeline: [],
      top_by_arguments: [],
      top_by_votes: [],
      recent_laws: [],
    }
    return NextResponse.json(empty)
  }

  const lawIds = allLaws.map((l) => l.id)

  // 2. Fetch argument counts per topic (for all laws)
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .in('topic_id', lawIds)

  const argCountByTopic: Record<string, number> = {}
  for (const row of argRows ?? []) {
    argCountByTopic[row.topic_id] = (argCountByTopic[row.topic_id] ?? 0) + 1
  }

  // 3. Build enriched law entries
  const enriched: LawEntry[] = allLaws.map((l) => ({
    id: l.id,
    statement: l.statement,
    category: l.category,
    blue_pct: l.blue_pct ?? 50,
    total_votes: l.total_votes ?? 0,
    view_count: l.view_count ?? 0,
    updated_at: l.updated_at,
    argument_count: argCountByTopic[l.id] ?? 0,
  }))

  // 4. Time-window counts
  const now = Date.now()
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

  let lawsThisMonth = 0
  let lawsThisWeek = 0
  let forSum = 0
  let decisive = 0
  let competitive = 0
  let close = 0

  for (const law of enriched) {
    const t = new Date(law.updated_at).getTime()
    if (t >= oneMonthAgo) lawsThisMonth++
    if (t >= oneWeekAgo) lawsThisWeek++

    forSum += law.blue_pct

    const margin = Math.abs(law.blue_pct - 50)
    if (margin >= 15) decisive++
    else if (margin >= 5) competitive++
    else close++
  }

  const avgForPct = enriched.length > 0 ? Math.round(forSum / enriched.length) : 50

  // 5. Category breakdown
  const catMap: Record<string, { count: number; marginSum: number; votesSum: number }> = {}
  for (const law of enriched) {
    const cat = law.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { count: 0, marginSum: 0, votesSum: 0 }
    catMap[cat].count++
    catMap[cat].marginSum += Math.abs(law.blue_pct - 50)
    catMap[cat].votesSum += law.total_votes
  }

  const categoryBreakdown: LawCategoryStat[] = Object.entries(catMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([category, s]) => ({
      category,
      count: s.count,
      avg_margin: Math.round(s.marginSum / s.count),
      avg_votes: Math.round(s.votesSum / s.count),
    }))

  // 6. Monthly timeline (last 12 months)
  const monthCounts: Record<string, number> = {}
  for (const law of enriched) {
    const d = new Date(law.updated_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthCounts[key] = (monthCounts[key] ?? 0) + 1
  }

  const monthlyTimeline: LawMonthlyPoint[] = Object.entries(monthCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, count]) => {
      const [y, m] = key.split('-')
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      })
      return { month: label, month_key: key, count }
    })

  // 7. Top lists
  const topByArguments = [...enriched]
    .sort((a, b) => b.argument_count - a.argument_count)
    .slice(0, 8)

  const topByVotes = [...enriched]
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 8)

  const recentLaws = enriched.slice(0, 10)

  return NextResponse.json({
    total_laws: enriched.length,
    laws_this_month: lawsThisMonth,
    laws_this_week: lawsThisWeek,
    avg_for_pct: avgForPct,
    decisive_count: decisive,
    competitive_count: competitive,
    close_count: close,
    category_breakdown: categoryBreakdown,
    monthly_timeline: monthlyTimeline,
    top_by_arguments: topByArguments,
    top_by_votes: topByVotes,
    recent_laws: recentLaws,
  } satisfies LawAnalyticsResponse)
}
