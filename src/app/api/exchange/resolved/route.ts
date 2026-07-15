import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedMarket {
  id: string
  statement: string
  category: string | null
  outcome: 'law' | 'failed'
  // Final price at resolution (blue_pct)
  final_price: number
  // Accuracy: % of voters who called it correctly
  accuracy: number
  // Vote counts
  total_votes: number
  correct_votes: number
  // Conviction: how decisive was the result? (distance from 50)
  conviction: number
  // Recency
  resolved_at: string
  created_at: string
}

export interface ResolvedResponse {
  markets: ResolvedMarket[]
  total: number
  stats: {
    total_resolved: number
    laws: number
    failed: number
    avg_accuracy: number
    avg_conviction: number
    avg_volume: number
  }
}

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const category = searchParams.get('category') || null
  const outcome  = searchParams.get('outcome')  || null   // 'law' | 'failed'
  const sort     = searchParams.get('sort')     || 'recent'
  const page     = Math.max(0, parseInt(searchParams.get('page') || '0', 10))

  // ── Base query ────────────────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, updated_at, created_at',
      { count: 'exact' }
    )
    .in('status', ['law', 'failed'])

  if (category) query = query.eq('category', category)
  if (outcome === 'law')    query = query.eq('status', 'law')
  if (outcome === 'failed') query = query.eq('status', 'failed')

  switch (sort) {
    case 'volume':
      query = query.order('total_votes', { ascending: false })
      break
    case 'accuracy':
      // We can't sort by computed column easily, so fetch and sort in JS
      query = query.order('total_votes', { ascending: false }).limit(200)
      break
    case 'conviction':
      // Similarly sort by abs(blue_pct - 50) in JS
      query = query.order('total_votes', { ascending: false }).limit(200)
      break
    case 'recent':
    default:
      query = query.order('updated_at', { ascending: false })
      break
  }

  if (sort === 'recent' || sort === 'volume') {
    query = query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  }

  const { data: rows, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rawMarkets: ResolvedMarket[] = (rows ?? []).map((r) => {
    const blueVotes = r.blue_votes ?? 0
    const redVotes  = r.red_votes  ?? 0
    const total     = r.total_votes ?? blueVotes + redVotes
    const finalPrice = Math.round(r.blue_pct ?? 50)
    const correctVotes = r.status === 'law' ? blueVotes : redVotes
    const accuracy = total > 0 ? Math.round((correctVotes / total) * 100) : 50
    const conviction = Math.abs(finalPrice - 50)

    return {
      id: r.id,
      statement: r.statement,
      category: r.category,
      outcome: r.status as 'law' | 'failed',
      final_price: finalPrice,
      accuracy,
      total_votes: total,
      correct_votes: correctVotes,
      conviction,
      resolved_at: r.updated_at,
      created_at: r.created_at,
    }
  })

  // JS-side sort for accuracy / conviction
  let markets = rawMarkets
  if (sort === 'accuracy') {
    markets = rawMarkets
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  } else if (sort === 'conviction') {
    markets = rawMarkets
      .sort((a, b) => b.conviction - a.conviction)
      .slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  }

  // ── Stats (full dataset, no pagination) ───────────────────────────────────
  let statsQuery = supabase
    .from('topics')
    .select('status, blue_pct, blue_votes, red_votes, total_votes')
    .in('status', ['law', 'failed'])

  if (category) statsQuery = statsQuery.eq('category', category)

  const { data: allRows } = await statsQuery

  const all = allRows ?? []
  const laws   = all.filter((r) => r.status === 'law').length
  const failed = all.filter((r) => r.status === 'failed').length

  const avgAccuracy = all.length > 0
    ? Math.round(
        all.reduce((sum, r) => {
          const t = r.total_votes ?? 0
          const c = r.status === 'law' ? (r.blue_votes ?? 0) : (r.red_votes ?? 0)
          return sum + (t > 0 ? c / t : 0.5)
        }, 0) / all.length * 100
      )
    : 50

  const avgConviction = all.length > 0
    ? Math.round(
        all.reduce((sum, r) => sum + Math.abs((r.blue_pct ?? 50) - 50), 0) / all.length
      )
    : 0

  const avgVolume = all.length > 0
    ? Math.round(all.reduce((sum, r) => sum + (r.total_votes ?? 0), 0) / all.length)
    : 0

  return NextResponse.json({
    markets,
    total: count ?? rawMarkets.length,
    stats: {
      total_resolved: laws + failed,
      laws,
      failed,
      avg_accuracy: avgAccuracy,
      avg_conviction: avgConviction,
      avg_volume: avgVolume,
    },
  } satisfies ResolvedResponse)
}
