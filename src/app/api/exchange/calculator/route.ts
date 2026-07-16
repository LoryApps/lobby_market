import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ────────────────────────────────────────────────────────────

export interface CalculatorTopic {
  id: string
  statement: string
  category: string | null
  status: string
  price: number        // blue_pct (0–100)
  volume: number       // total_votes
  voting_ends_at: string | null
  created_at: string
}

export interface HistoricalBand {
  label: string         // e.g. "55–60¢"
  low: number
  high: number
  total: number
  law_count: number
  law_rate: number      // 0–1
}

export interface CalculatorData {
  topic: CalculatorTopic
  // Historical resolution stats for topics at a similar price
  historical: HistoricalBand[]
  // Aggregate stats about the current market
  law_threshold: number          // 67 (the consensus threshold)
  distance_to_law: number        // price - 67 (negative = below threshold)
  votes_needed_for: number       // additional FOR votes needed to hit 67%
  votes_needed_against: number   // additional AGAINST votes needed to fail (reach 33%)
  current_percentile: number     // where this topic sits vs all active topics (0–100)
  // Similar resolved topics (same category, similar price at resolution)
  similar_resolved: Array<{
    id: string
    statement: string
    category: string | null
    final_price: number
    final_status: string
    total_votes: number
  }>
}

export interface CalculatorSearchResult {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
}

// ─── GET: search for topics by query string ───────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const topicId = searchParams.get('id')
  const query = searchParams.get('q') ?? ''

  // ── Search mode: return a list of matching topics ─────────────────────────
  if (!topicId) {
    if (query.length < 2) {
      // Default: return top-volume active topics
      const { data } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('status', ['active', 'voting'])
        .order('total_votes', { ascending: false })
        .limit(12)

      const results: CalculatorSearchResult[] = (data ?? []).map((r) => ({
        id: r.id,
        statement: r.statement,
        category: r.category,
        status: r.status,
        price: r.blue_pct ?? 50,
        volume: r.total_votes ?? 0,
      }))

      return NextResponse.json({ results })
    }

    const { data } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .ilike('statement', `%${query}%`)
      .order('total_votes', { ascending: false })
      .limit(8)

    const results: CalculatorSearchResult[] = (data ?? []).map((r) => ({
      id: r.id,
      statement: r.statement,
      category: r.category,
      status: r.status,
      price: r.blue_pct ?? 50,
      volume: r.total_votes ?? 0,
    }))

    return NextResponse.json({ results })
  }

  // ── Detail mode: return full calculator data for a specific topic ──────────

  const { data: topicRow, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at, created_at')
    .eq('id', topicId)
    .single()

  if (error || !topicRow) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const price = topicRow.blue_pct ?? 50
  const volume = topicRow.total_votes ?? 0
  const LAW_THRESHOLD = 67
  const FAIL_THRESHOLD = 33

  // ── Votes needed calculations ─────────────────────────────────────────────
  // If total votes = V, for votes = price * V / 100
  // We need for_pct = 67%, so for_votes / (for_votes + against_votes + X) = 0.67
  // Solving for new FOR votes needed:
  //   new_for + for = 0.67 * (new_for + total)
  //   new_for * (1 - 0.67) = 0.67 * total - for
  //   new_for = (0.67 * total - for) / 0.33
  const forVotes = (price / 100) * volume
  const votesNeededFor = price < LAW_THRESHOLD
    ? Math.max(0, Math.ceil((LAW_THRESHOLD / 100 * volume - forVotes) / (1 - LAW_THRESHOLD / 100)))
    : 0

  // Votes needed for AGAINST to push below 33%:
  //   against + new_against >= 0.67 * (total + new_against)
  //   new_against * (1 - 0.67) >= 0.67 * total - against
  const againstVotes = volume - forVotes
  const votesNeededAgainst = price > FAIL_THRESHOLD
    ? Math.max(0, Math.ceil(((1 - FAIL_THRESHOLD / 100) * volume - againstVotes) / (FAIL_THRESHOLD / 100)))
    : 0

  // ── Historical resolution rates by price band ──────────────────────────────
  // Fetch all resolved topics with their final blue_pct
  const { data: resolvedTopics } = await supabase
    .from('topics')
    .select('blue_pct, status')
    .in('status', ['law', 'failed'])
    .not('blue_pct', 'is', null)

  const BANDS: HistoricalBand[] = [
    { label: '< 33¢', low: 0, high: 33, total: 0, law_count: 0, law_rate: 0 },
    { label: '33–40¢', low: 33, high: 40, total: 0, law_count: 0, law_rate: 0 },
    { label: '40–47¢', low: 40, high: 47, total: 0, law_count: 0, law_rate: 0 },
    { label: '47–53¢', low: 47, high: 53, total: 0, law_count: 0, law_rate: 0 },
    { label: '53–60¢', low: 53, high: 60, total: 0, law_count: 0, law_rate: 0 },
    { label: '60–67¢', low: 60, high: 67, total: 0, law_count: 0, law_rate: 0 },
    { label: '67–75¢', low: 67, high: 75, total: 0, law_count: 0, law_rate: 0 },
    { label: '> 75¢', low: 75, high: 100, total: 0, law_count: 0, law_rate: 0 },
  ]

  for (const r of resolvedTopics ?? []) {
    const p = r.blue_pct ?? 50
    for (const band of BANDS) {
      if (p >= band.low && p < band.high) {
        band.total++
        if (r.status === 'law') band.law_count++
        break
      }
    }
  }

  for (const band of BANDS) {
    band.law_rate = band.total > 0 ? band.law_count / band.total : 0
  }

  // ── Percentile vs other active topics ─────────────────────────────────────
  const { data: allActive } = await supabase
    .from('topics')
    .select('blue_pct')
    .in('status', ['active', 'voting'])
    .not('blue_pct', 'is', null)

  const activePrices = (allActive ?? []).map((r) => r.blue_pct ?? 50).sort((a, b) => a - b)
  const below = activePrices.filter((p) => p < price).length
  const percentile = activePrices.length > 0 ? Math.round((below / activePrices.length) * 100) : 50

  // ── Similar resolved topics ───────────────────────────────────────────────
  const priceLow = Math.max(0, price - 10)
  const priceHigh = Math.min(100, price + 10)

  const { data: similar } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, status, total_votes')
    .in('status', ['law', 'failed'])
    .eq('category', topicRow.category ?? '')
    .gte('blue_pct', priceLow)
    .lte('blue_pct', priceHigh)
    .order('total_votes', { ascending: false })
    .limit(5)

  const topic: CalculatorTopic = {
    id: topicRow.id,
    statement: topicRow.statement,
    category: topicRow.category,
    status: topicRow.status,
    price,
    volume,
    voting_ends_at: topicRow.voting_ends_at,
    created_at: topicRow.created_at,
  }

  const result: CalculatorData = {
    topic,
    historical: BANDS,
    law_threshold: LAW_THRESHOLD,
    distance_to_law: price - LAW_THRESHOLD,
    votes_needed_for: votesNeededFor,
    votes_needed_against: votesNeededAgainst,
    current_percentile: percentile,
    similar_resolved: (similar ?? []).map((r) => ({
      id: r.id,
      statement: r.statement,
      category: r.category,
      final_price: r.blue_pct ?? 50,
      final_status: r.status,
      total_votes: r.total_votes ?? 0,
    })),
  }

  return NextResponse.json(result)
}
