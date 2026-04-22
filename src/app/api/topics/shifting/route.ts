import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShiftingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  votes_24h: number
  recent_blue_pct: number
  /** positive = trending For (blue surge), negative = trending Against (red surge) */
  delta: number
  direction: 'for' | 'against'
}

export interface ShiftingResponse {
  surging_for: ShiftingTopic[]
  surging_against: ShiftingTopic[]
  window_start: string
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_RECENT_VOTES = 5
const MIN_DELTA = 8 // percentage-point gap to flag as a shift
const MAX_PER_SIDE = 20
const VOTE_WINDOW_HOURS = 24

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') || null

  const supabase = await createClient()

  const windowStart = new Date(
    Date.now() - VOTE_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  // ── 1. Fetch recent votes (last 24 h) with side ──────────────────────────
  const { data: recentVotes, error: votesError } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .gte('created_at', windowStart)
    .limit(30000)

  if (votesError) {
    return NextResponse.json(
      { error: 'Failed to fetch votes' },
      { status: 500 }
    )
  }

  const votes = recentVotes ?? []

  // Aggregate per topic
  const byTopic = new Map<string, { blue: number; red: number }>()
  for (const v of votes) {
    const existing = byTopic.get(v.topic_id) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') existing.blue++
    else existing.red++
    byTopic.set(v.topic_id, existing)
  }

  // Only keep topics with enough recent votes
  const qualifiedIds = Array.from(byTopic.entries())
    .filter(([, counts]) => counts.blue + counts.red >= MIN_RECENT_VOTES)
    .map(([id]) => id)

  if (qualifiedIds.length === 0) {
    return NextResponse.json({
      surging_for: [],
      surging_against: [],
      window_start: windowStart,
      generated_at: new Date().toISOString(),
    } satisfies ShiftingResponse)
  }

  // ── 2. Fetch topic metadata for qualified ids ────────────────────────────
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', qualifiedIds)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .gt('total_votes', MIN_RECENT_VOTES + 2)

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicsRaw } = await topicsQuery.limit(500)
  const topics = topicsRaw ?? []

  // ── 3. Compute deltas ────────────────────────────────────────────────────
  const results: ShiftingTopic[] = []

  for (const topic of topics) {
    const recent = byTopic.get(topic.id)
    if (!recent) continue

    const totalRecent = recent.blue + recent.red
    if (totalRecent < MIN_RECENT_VOTES) continue

    const recentBluePct = (recent.blue / totalRecent) * 100
    const historicalBluePct = topic.blue_pct ?? 50
    const delta = recentBluePct - historicalBluePct

    if (Math.abs(delta) < MIN_DELTA) continue

    results.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: historicalBluePct,
      total_votes: topic.total_votes ?? 0,
      votes_24h: totalRecent,
      recent_blue_pct: Math.round(recentBluePct),
      delta: Math.round(delta),
      direction: delta > 0 ? 'for' : 'against',
    })
  }

  // Sort and split
  results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const surgingFor = results
    .filter((t) => t.direction === 'for')
    .slice(0, MAX_PER_SIDE)

  const surgingAgainst = results
    .filter((t) => t.direction === 'against')
    .slice(0, MAX_PER_SIDE)

  return NextResponse.json({
    surging_for: surgingFor,
    surging_against: surgingAgainst,
    window_start: windowStart,
    generated_at: new Date().toISOString(),
  } satisfies ShiftingResponse)
}
