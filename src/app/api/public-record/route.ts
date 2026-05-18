import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicRecord {
  id: string
  statement: string
  category: string | null
  scope: string | null
  status: 'law' | 'failed'
  blue_pct: number
  blue_votes: number
  red_votes: number
  total_votes: number
  decided_at: string
  created_at: string
}

export interface PublicRecordStats {
  total_laws: number
  total_failed: number
  total_decisions: number
  total_votes_cast: number
  total_participants: number
  laws_this_month: number
  most_decisive_id: string | null
  most_decisive_statement: string | null
  most_decisive_pct: number | null
  closest_id: string | null
  closest_statement: string | null
  closest_pct: number | null
}

export interface PublicRecordResponse {
  records: PublicRecord[]
  stats: PublicRecordStats
  has_more: boolean
  next_cursor: string | null
  total_count: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const outcome = searchParams.get('outcome') ?? 'all' // 'all' | 'law' | 'failed'
  const category = searchParams.get('category') ?? null
  const q = searchParams.get('q') ?? null
  const sort = searchParams.get('sort') ?? 'recent' // 'recent' | 'votes' | 'consensus'
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20), 50)
  const cursor = searchParams.get('cursor') ?? null

  // ── Build main query ────────────────────────────────────────────────────────

  let query = supabase
    .from('topics')
    .select('id, statement, category, scope, status, blue_pct, blue_votes, red_votes, total_votes, created_at, updated_at')

  // Outcome filter
  if (outcome === 'law') {
    query = query.eq('status', 'law')
  } else if (outcome === 'failed') {
    query = query.eq('status', 'failed')
  } else {
    query = query.in('status', ['law', 'failed'])
  }

  // Category filter
  if (category) query = query.eq('category', category)

  // Full-text search
  if (q) {
    query = query.ilike('statement', `%${q}%`)
  }

  // Cursor pagination
  if (cursor) {
    if (sort === 'recent') {
      query = query.lt('updated_at', cursor)
    } else if (sort === 'votes') {
      query = query.lt('total_votes', parseInt(cursor, 10))
    } else {
      // consensus: cursor is blue_pct (descending from 100 for laws, ascending from 0 for failed)
      query = query.lt('updated_at', cursor)
    }
  }

  // Sort
  if (sort === 'votes') {
    query = query.order('total_votes', { ascending: false })
  } else if (sort === 'consensus') {
    query = query.order('blue_pct', { ascending: false })
  } else {
    query = query.order('updated_at', { ascending: false })
  }

  const { data: rows, error } = await query.limit(limit + 1)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
  }

  const items = rows ?? []
  const has_more = items.length > limit
  const records = items.slice(0, limit).map((r) => ({
    id: r.id,
    statement: r.statement,
    category: r.category,
    scope: r.scope,
    status: r.status as 'law' | 'failed',
    blue_pct: r.blue_pct ?? 50,
    blue_votes: r.blue_votes ?? 0,
    red_votes: r.red_votes ?? 0,
    total_votes: r.total_votes ?? 0,
    decided_at: r.updated_at,
    created_at: r.created_at,
  }))

  // Cursor for next page
  let next_cursor: string | null = null
  if (has_more && records.length > 0) {
    const last = records[records.length - 1]
    if (sort === 'votes') {
      next_cursor = String(last.total_votes)
    } else {
      next_cursor = last.decided_at
    }
  }

  // ── Platform stats ──────────────────────────────────────────────────────────

  const { data: allDecided } = await supabase
    .from('topics')
    .select('id, status, blue_pct, total_votes, blue_votes, red_votes, updated_at, statement')
    .in('status', ['law', 'failed'])

  const decided = allDecided ?? []
  const laws = decided.filter((t) => t.status === 'law')
  const failed = decided.filter((t) => t.status === 'failed')

  const totalVotesCast = decided.reduce((s, t) => s + (t.total_votes ?? 0), 0)

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const lawsThisMonth = laws.filter((t) => t.updated_at >= monthAgo).length

  // Most decisive law (highest FOR%)
  const mostDecisive = laws.reduce<(typeof laws)[0] | null>((best, t) => {
    if (!best || (t.blue_pct ?? 0) > (best.blue_pct ?? 0)) return t
    return best
  }, null)

  // Closest call (law or failed nearest 50%)
  const closest = decided.reduce<(typeof decided)[0] | null>((best, t) => {
    const dist = Math.abs((t.blue_pct ?? 50) - 50)
    if (!best) return t
    const bestDist = Math.abs((best.blue_pct ?? 50) - 50)
    return dist < bestDist ? t : best
  }, null)

  const stats: PublicRecordStats = {
    total_laws: laws.length,
    total_failed: failed.length,
    total_decisions: decided.length,
    total_votes_cast: totalVotesCast,
    total_participants: 0, // approximate — no easy distinct count without rpc
    laws_this_month: lawsThisMonth,
    most_decisive_id: mostDecisive?.id ?? null,
    most_decisive_statement: mostDecisive?.statement ?? null,
    most_decisive_pct: mostDecisive?.blue_pct ?? null,
    closest_id: closest?.id ?? null,
    closest_statement: closest?.statement ?? null,
    closest_pct: closest?.blue_pct ?? null,
  }

  return NextResponse.json({
    records,
    stats,
    has_more,
    next_cursor,
    total_count: decided.length,
  } satisfies PublicRecordResponse)
}
