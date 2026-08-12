import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReversalDirection = 'flipped_against' | 'flipped_for'

export interface ReversalTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string

  // Price history
  initial_price: number     // FOR% when topic first gained traction (first snapshot ≥ 20 votes)
  current_price: number     // Current FOR%

  // Reversal metrics
  direction: ReversalDirection
  price_swing: number       // Absolute percentage-point swing (always positive)
  crossed_at_price: number  // The snapshot price where 50% was crossed (nearest to the crossing)
  votes_since_creation: number
  snapshots_count: number
}

export interface ReversalResponse {
  flipped_for: ReversalTopic[]
  flipped_against: ReversalTopic[]
  total: number
  category_filter: string | null
  min_swing: number
}

// ─── GET /api/reversal ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category')?.trim() ?? ''
  const rawMinSwing = parseFloat(searchParams.get('min_swing') ?? '5')
  const rawSort = searchParams.get('sort') ?? 'swing'
  const rawLimit = parseInt(searchParams.get('limit') ?? '30', 10)

  const VALID_CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
    'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null
  const minSwing = Number.isFinite(rawMinSwing) && rawMinSwing >= 1 ? rawMinSwing : 5
  const sort = ['swing', 'votes', 'recent'].includes(rawSort) ? rawSort : 'swing'
  const limit = Math.min(Math.max(rawLimit, 5), 50)

  const supabase = await createClient()

  // ── Step 1: Fetch topics with enough vote history ─────────────────────────

  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gte('total_votes', 40)   // need at least 2 snapshots (one every 20 votes)
    .order('total_votes', { ascending: false })
    .limit(300)

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicRows, error: topicsError } = await topicsQuery
  if (topicsError || !topicRows?.length) {
    return NextResponse.json<ReversalResponse>({
      flipped_for: [],
      flipped_against: [],
      total: 0,
      category_filter: category,
      min_swing: minSwing,
    })
  }

  const topicIds = topicRows.map((t) => t.id)

  // ── Step 2: Fetch all price history snapshots for these topics ────────────
  // We order ascending so we can detect the first snapshot (initial price)

  const { data: historyRows } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, volume, recorded_at')
    .in('topic_id', topicIds)
    .order('recorded_at', { ascending: true })

  if (!historyRows?.length) {
    return NextResponse.json<ReversalResponse>({
      flipped_for: [],
      flipped_against: [],
      total: 0,
      category_filter: category,
      min_swing: minSwing,
    })
  }

  // ── Step 3: Group snapshots by topic ──────────────────────────────────────

  const snapshotsByTopic = new Map<string, Array<{ price: number; volume: number; recorded_at: string }>>()
  for (const row of historyRows) {
    const existing = snapshotsByTopic.get(row.topic_id) ?? []
    existing.push({ price: row.price, volume: row.volume, recorded_at: row.recorded_at })
    snapshotsByTopic.set(row.topic_id, existing)
  }

  // ── Step 4: Identify reversals ────────────────────────────────────────────

  const topicMap = new Map(topicRows.map((t) => [t.id, t]))
  const reversals: ReversalTopic[] = []

  for (const [topicId, snapshots] of snapshotsByTopic) {
    if (snapshots.length < 2) continue   // need at least first + one more to detect a swing

    const topic = topicMap.get(topicId)
    if (!topic) continue

    // Use the first snapshot as the initial price
    const firstSnap = snapshots[0]
    const initialPrice = firstSnap.price
    const currentPrice = typeof topic.blue_pct === 'number' ? topic.blue_pct : 50

    // Check if the majority crossed 50%
    const initialSide = initialPrice >= 50 ? 'for' : 'against'
    const currentSide = currentPrice >= 50 ? 'for' : 'against'

    if (initialSide === currentSide) continue   // no reversal

    const priceSwing = Math.abs(currentPrice - initialPrice)
    if (priceSwing < minSwing) continue         // too small a swing

    // Find the snapshot closest to where the crossing happened
    let crossedAtPrice = currentPrice
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1].price
      const cur = snapshots[i].price
      // Detect the crossing point
      if ((prev >= 50) !== (cur >= 50)) {
        crossedAtPrice = cur
        break
      }
    }

    const direction: ReversalDirection =
      initialSide === 'for' ? 'flipped_against' : 'flipped_for'

    reversals.push({
      id: topicId,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: currentPrice,
      total_votes: topic.total_votes,
      created_at: topic.created_at,
      initial_price: Math.round(initialPrice * 10) / 10,
      current_price: Math.round(currentPrice * 10) / 10,
      direction,
      price_swing: Math.round(priceSwing * 10) / 10,
      crossed_at_price: Math.round(crossedAtPrice * 10) / 10,
      votes_since_creation: topic.total_votes,
      snapshots_count: snapshots.length,
    })
  }

  // ── Step 5: Sort ──────────────────────────────────────────────────────────

  reversals.sort((a, b) => {
    if (sort === 'swing') return b.price_swing - a.price_swing
    if (sort === 'votes') return b.total_votes - a.total_votes
    // recent: by created_at desc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const flipped_for = reversals.filter((r) => r.direction === 'flipped_for').slice(0, limit)
  const flipped_against = reversals.filter((r) => r.direction === 'flipped_against').slice(0, limit)

  return NextResponse.json<ReversalResponse>({
    flipped_for,
    flipped_against,
    total: reversals.length,
    category_filter: category,
    min_swing: minSwing,
  })
}
