import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeatmapCell {
  category: string
  status: string
  count: number
  avg_blue_pct: number
  total_votes: number
}

export interface HeatmapResponse {
  cells: HeatmapCell[]
  categories: readonly string[]
  statuses: readonly string[]
  max_count: number
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const STATUSES = ['proposed', 'active', 'voting', 'law', 'failed'] as const

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('topics')
    .select('category, status, blue_pct, total_votes')
    .in('category', CATEGORIES)
    .in('status', STATUSES)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate into a map keyed by "category:status"
  const agg: Record<
    string,
    { count: number; blue_pct_sum: number; total_votes: number }
  > = {}

  for (const row of rows ?? []) {
    if (!row.category || !row.status) continue
    const key = `${row.category}:${row.status}`
    if (!agg[key]) {
      agg[key] = { count: 0, blue_pct_sum: 0, total_votes: 0 }
    }
    agg[key].count += 1
    agg[key].blue_pct_sum += row.blue_pct ?? 50
    agg[key].total_votes += row.total_votes ?? 0
  }

  const cells: HeatmapCell[] = []
  for (const cat of CATEGORIES) {
    for (const status of STATUSES) {
      const key = `${cat}:${status}`
      const entry = agg[key] ?? { count: 0, blue_pct_sum: 0, total_votes: 0 }
      cells.push({
        category: cat,
        status,
        count: entry.count,
        avg_blue_pct: entry.count > 0 ? entry.blue_pct_sum / entry.count : 50,
        total_votes: entry.total_votes,
      })
    }
  }

  const max_count = Math.max(...cells.map((c) => c.count), 1)

  return NextResponse.json({
    cells,
    categories: CATEGORIES,
    statuses: STATUSES,
    max_count,
    generated_at: new Date().toISOString(),
  } satisfies HeatmapResponse)
}
