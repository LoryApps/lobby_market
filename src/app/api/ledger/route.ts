import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  id: string
  entry_number: number
  statement: string
  category: string | null
  scope: string | null
  verdict: 'ESTABLISHED' | 'FAILED'
  final_blue_pct: number
  total_votes: number
  decided_at: string
  created_at: string
  duration_days: number
}

export interface LedgerStats {
  total_entries: number
  laws_count: number
  failed_count: number
  pass_rate: number
  avg_votes_per_decision: number
  avg_duration_days: number
  categories: Array<{
    category: string
    total: number
    laws: number
    failed: number
    pass_rate: number
  }>
}

export interface LedgerResponse {
  entries: LedgerEntry[]
  stats: LedgerStats
  total_count: number
  page: number
  page_size: number
  updated_at: string
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(50, Math.max(10, parseInt(searchParams.get('page_size') ?? '25', 10)))
  const filter   = searchParams.get('filter') ?? 'all'   // 'all' | 'law' | 'failed'
  const category = searchParams.get('category') ?? null
  const sort     = searchParams.get('sort') ?? 'recent'  // 'recent' | 'oldest' | 'votes'

  const supabase = await createClient()

  // Build status filter
  const statuses: string[] =
    filter === 'law'    ? ['law']    :
    filter === 'failed' ? ['failed'] :
    ['law', 'failed']

  // ── Fetch all decided topics for stats ─────────────────────────────────────
  const { data: allDecided, error: statsError } = await supabase
    .from('topics')
    .select('id, category, status, blue_pct, total_votes, created_at, updated_at')
    .in('status', ['law', 'failed'])

  if (statsError) {
    return NextResponse.json({ error: 'Failed to load ledger' }, { status: 500 })
  }

  const allRows = allDecided ?? []
  const totalLaws   = allRows.filter((r) => r.status === 'law').length
  const totalFailed = allRows.filter((r) => r.status === 'failed').length
  const totalAll    = allRows.length

  // Average votes per decision
  const avgVotes = totalAll > 0
    ? Math.round(allRows.reduce((s, r) => s + (r.total_votes ?? 0), 0) / totalAll)
    : 0

  // Average duration (created → decided)
  const durations = allRows.map((r) => {
    const created = new Date(r.created_at).getTime()
    const decided = new Date(r.updated_at).getTime()
    return Math.max(0, (decided - created) / (1000 * 60 * 60 * 24))
  })
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
    : 0

  // Category breakdown
  const catMap = new Map<string, { total: number; laws: number; failed: number }>()
  for (const r of allRows) {
    const cat = r.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { total: 0, laws: 0, failed: 0 })
    const c = catMap.get(cat)!
    c.total++
    if (r.status === 'law') c.laws++
    else c.failed++
  }
  const categories = Array.from(catMap.entries())
    .map(([cat, c]) => ({
      category: cat,
      total:     c.total,
      laws:      c.laws,
      failed:    c.failed,
      pass_rate: c.total > 0 ? Math.round((c.laws / c.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // ── Fetch paginated entries ────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, scope, status, blue_pct, total_votes, created_at, updated_at', { count: 'exact' })
    .in('status', statuses)

  if (category) query = query.eq('category', category)

  // Sort
  if (sort === 'oldest') {
    query = query.order('updated_at', { ascending: true })
  } else if (sort === 'votes') {
    query = query.order('total_votes', { ascending: false })
  } else {
    query = query.order('updated_at', { ascending: false })
  }

  query = query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data: rows, error: rowsError } = await query

  if (rowsError) {
    return NextResponse.json({ error: 'Failed to load ledger entries' }, { status: 500 })
  }

  // Total count for this filter (unfiltered = total decided)
  const filteredTotal =
    filter === 'law'    ? totalLaws   :
    filter === 'failed' ? totalFailed :
    totalAll

  // Assign entry numbers: entry_number counts from 1 upward in chronological order.
  // We need the global rank of each row. We fetch their updated_at position.
  // For 'recent' sort, #1 is oldest. Entry number = (total_matching - index).
  // To keep it simple: determine each row's chronological rank by sorting all allDecided.
  const allSorted = [...allRows].sort((a, b) =>
    new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  )
  const rankMap = new Map<string, number>()
  allSorted.forEach((r, i) => rankMap.set(r.id, i + 1))

  const entries: LedgerEntry[] = (rows ?? []).map((r) => {
    const created = new Date(r.created_at).getTime()
    const decided = new Date(r.updated_at).getTime()
    const durationDays = Math.max(0, Math.round((decided - created) / (1000 * 60 * 60 * 24)))
    return {
      id:           r.id,
      entry_number: rankMap.get(r.id) ?? 0,
      statement:    r.statement,
      category:     r.category,
      scope:        r.scope,
      verdict:      r.status === 'law' ? 'ESTABLISHED' : 'FAILED',
      final_blue_pct: Math.round((r.blue_pct ?? 50) * 10) / 10,
      total_votes:  r.total_votes ?? 0,
      decided_at:   r.updated_at,
      created_at:   r.created_at,
      duration_days: durationDays,
    }
  })

  const stats: LedgerStats = {
    total_entries:          totalAll,
    laws_count:             totalLaws,
    failed_count:           totalFailed,
    pass_rate:              totalAll > 0 ? Math.round((totalLaws / totalAll) * 100) : 0,
    avg_votes_per_decision: avgVotes,
    avg_duration_days:      avgDuration,
    categories,
  }

  return NextResponse.json({
    entries,
    stats,
    total_count:  filteredTotal,
    page,
    page_size:    pageSize,
    updated_at:   new Date().toISOString(),
  } satisfies LedgerResponse, {
    headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
  })
}
