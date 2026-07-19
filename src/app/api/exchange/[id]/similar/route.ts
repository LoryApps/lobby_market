import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimilarMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
  scope: string
  is_hot: boolean
  is_near_law: boolean
  is_closing_soon: boolean
  voting_ends_at: string | null
  match_reason: 'category' | 'consensus' | 'contested' | 'scope'
}

export interface SimilarMarketsData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    scope: string
  }
  by_category: SimilarMarket[]
  by_consensus: SimilarMarket[]
  by_scope: SimilarMarket[]
  contested: SimilarMarket[]
  total: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Fetch anchor market ────────────────────────────────────────────────
  const { data: anchor } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, feed_score, voting_ends_at')
    .eq('id', id)
    .maybeSingle()

  if (!anchor) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  const anchorPrice = anchor.blue_pct ?? 50
  const anchorCategory = anchor.category ?? null
  const anchorScope = anchor.scope ?? 'national'
  const now = Date.now()

  // ── 2. Row shape ──────────────────────────────────────────────────────────
  interface TopicRow {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
    total_votes: number | null
    scope: string | null
    feed_score: number | null
    voting_ends_at: string | null
  }

  // ── 3. By category (same category, any price) ─────────────────────────────
  const { data: catRows } = anchorCategory
    ? await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, scope, feed_score, voting_ends_at')
        .eq('category', anchorCategory)
        .neq('id', id)
        .in('status', ['voting', 'active', 'law'])
        .order('feed_score', { ascending: false })
        .limit(12)
    : { data: [] as TopicRow[] }

  // ── 4. By consensus (±15% price band, any category) ──────────────────────
  const priceLow = Math.max(0, anchorPrice - 15)
  const priceHigh = Math.min(100, anchorPrice + 15)

  const { data: priceRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, feed_score, voting_ends_at')
    .neq('id', id)
    .neq('category', anchorCategory ?? '')
    .gte('blue_pct', priceLow)
    .lte('blue_pct', priceHigh)
    .in('status', ['voting', 'active'])
    .order('feed_score', { ascending: false })
    .limit(10)

  // ── 5. By scope (same scope, cross-category) ──────────────────────────────
  const { data: scopeRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, feed_score, voting_ends_at')
    .eq('scope', anchorScope)
    .neq('id', id)
    .neq('category', anchorCategory ?? '')
    .in('status', ['voting', 'active'])
    .order('feed_score', { ascending: false })
    .limit(8)

  // ── 6. Contested markets (deadlocked, 40–60% range) ──────────────────────
  const { data: contestedRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, feed_score, voting_ends_at')
    .neq('id', id)
    .gte('blue_pct', 40)
    .lte('blue_pct', 60)
    .in('status', ['voting', 'active'])
    .order('total_votes', { ascending: false })
    .limit(8)

  // ── 7. Transform helper ───────────────────────────────────────────────────
  function toSimilar(row: TopicRow, reason: SimilarMarket['match_reason']): SimilarMarket {
    const price = row.blue_pct ?? 50
    const closingInMs = row.voting_ends_at
      ? new Date(row.voting_ends_at).getTime() - now
      : null
    return {
      id: row.id,
      statement: row.statement,
      category: row.category,
      status: row.status,
      price,
      volume: row.total_votes ?? 0,
      scope: row.scope ?? 'national',
      is_hot: (row.feed_score ?? 0) > 800,
      is_near_law: price >= 60 && price < 67,
      is_closing_soon: closingInMs !== null && closingInMs > 0 && closingInMs < 86_400_000 * 3,
      voting_ends_at: row.voting_ends_at,
      match_reason: reason,
    }
  }

  const byCategory = (catRows as TopicRow[] | null ?? []).map((r) => toSimilar(r, 'category'))
  const byConsensus = (priceRows as TopicRow[] | null ?? []).map((r) => toSimilar(r, 'consensus'))
  const byScope = (scopeRows as TopicRow[] | null ?? []).map((r) => toSimilar(r, 'scope'))
  const contested = (contestedRows as TopicRow[] | null ?? [])
    .filter((r) => r.id !== id)
    .map((r) => toSimilar(r, 'contested'))

  // Dedup contested: remove any already shown in byCategory or byConsensus
  const shownIds = new Set([
    ...byCategory.map((m) => m.id),
    ...byConsensus.map((m) => m.id),
  ])
  const contestedFiltered = contested.filter((m) => !shownIds.has(m.id)).slice(0, 6)

  const total = byCategory.length + byConsensus.length + byScope.length + contestedFiltered.length

  const result: SimilarMarketsData = {
    topic: {
      id: anchor.id as string,
      statement: anchor.statement as string,
      category: anchorCategory,
      status: anchor.status as string,
      price: anchorPrice,
      scope: anchorScope,
    },
    by_category: byCategory.slice(0, 8),
    by_consensus: byConsensus.slice(0, 6),
    by_scope: byScope.slice(0, 6),
    contested: contestedFiltered,
    total,
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}
