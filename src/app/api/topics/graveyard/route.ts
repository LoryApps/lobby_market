import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { causeOfDeath, CAUSE_CONFIG } from '@/lib/graveyard/config'
import type { CauseOfDeath } from '@/lib/graveyard/config'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraveyardTopic {
  id: string
  statement: string
  category: string | null
  scope: string | null
  blue_pct: number
  total_votes: number
  created_at: string
  updated_at: string
  cause: CauseOfDeath
  days_alive: number
}

export interface GraveyardStats {
  total_failed: number
  total_votes_cast: number
  most_voted_id: string | null
  most_voted_statement: string | null
  closest_call_id: string | null
  closest_call_statement: string | null
  closest_call_pct: number | null
}

export interface GraveyardResponse {
  topics: GraveyardTopic[]
  stats: GraveyardStats
  has_more: boolean
  next_cursor: string | null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category') ?? null
  const cause = searchParams.get('cause') as CauseOfDeath | null
  const sort = searchParams.get('sort') ?? 'votes'   // 'votes' | 'recent' | 'closest'
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '24', 10) || 24), 50)
  const cursor = searchParams.get('cursor') ?? null

  // ── Fetch failed topics ──────────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, scope, blue_pct, total_votes, created_at, updated_at')
    .eq('status', 'failed')

  if (category) query = query.eq('category', category)

  // Apply cursor-based pagination on the sort field
  if (cursor) {
    if (sort === 'votes') {
      query = query.lt('total_votes', parseInt(cursor, 10))
    } else if (sort === 'recent') {
      query = query.lt('updated_at', cursor)
    } else {
      // closest: cursor is a blue_pct value (distance from 50)
      query = query.lt('blue_pct', parseFloat(cursor))
    }
  }

  // Sort order
  if (sort === 'votes') {
    query = query.order('total_votes', { ascending: false })
  } else if (sort === 'recent') {
    query = query.order('updated_at', { ascending: false })
  } else {
    // closest: sort by blue_pct DESC (highest = closest to consensus threshold)
    query = query.order('blue_pct', { ascending: false })
  }

  query = query.limit(limit + 1)

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch graveyard data' }, { status: 500 })
  }

  const rawTopics = (rows ?? []) as {
    id: string
    statement: string
    category: string | null
    scope: string | null
    blue_pct: number | null
    total_votes: number | null
    created_at: string
    updated_at: string
  }[]

  const has_more = rawTopics.length > limit
  if (has_more) rawTopics.pop()

  // Map to GraveyardTopic
  let topics: GraveyardTopic[] = rawTopics.map((t) => {
    const bluePct = t.blue_pct ?? 50
    const totalVotes = t.total_votes ?? 0
    const daysAlive = Math.round(
      (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86_400_000
    )
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      scope: t.scope,
      blue_pct: bluePct,
      total_votes: totalVotes,
      created_at: t.created_at,
      updated_at: t.updated_at,
      cause: causeOfDeath(bluePct, totalVotes),
      days_alive: Math.max(0, daysAlive),
    }
  })

  // Apply cause filter in JS after computing cause
  if (cause && CAUSE_CONFIG[cause]) {
    topics = topics.filter((t) => t.cause === cause)
  }

  // Determine next cursor
  let next_cursor: string | null = null
  if (has_more && topics.length > 0) {
    const last = topics[topics.length - 1]
    if (sort === 'votes') next_cursor = String(last.total_votes)
    else if (sort === 'recent') next_cursor = last.updated_at
    else next_cursor = String(last.blue_pct)
  }

  // ── Summary stats (only on first page, no cursor) ──────────────────────────
  const stats: GraveyardStats = {
    total_failed: 0,
    total_votes_cast: 0,
    most_voted_id: null,
    most_voted_statement: null,
    closest_call_id: null,
    closest_call_statement: null,
    closest_call_pct: null,
  }

  if (!cursor) {
    const { data: allFailed } = await supabase
      .from('topics')
      .select('id, statement, blue_pct, total_votes')
      .eq('status', 'failed')

    const allRows = (allFailed ?? []) as {
      id: string
      statement: string
      blue_pct: number | null
      total_votes: number | null
    }[]

    stats.total_failed = allRows.length
    stats.total_votes_cast = allRows.reduce((s, r) => s + (r.total_votes ?? 0), 0)

    const mostVoted = allRows.reduce<typeof allRows[0] | null>(
      (best, r) => (!best || (r.total_votes ?? 0) > (best.total_votes ?? 0) ? r : best),
      null
    )
    if (mostVoted) {
      stats.most_voted_id = mostVoted.id
      stats.most_voted_statement = mostVoted.statement
    }

    // Closest call: highest blue_pct that still failed
    const closestCall = allRows
      .filter((r) => (r.total_votes ?? 0) >= 10)
      .reduce<typeof allRows[0] | null>(
        (best, r) => (!best || (r.blue_pct ?? 0) > (best.blue_pct ?? 0) ? r : best),
        null
      )
    if (closestCall) {
      stats.closest_call_id = closestCall.id
      stats.closest_call_statement = closestCall.statement
      stats.closest_call_pct = closestCall.blue_pct ?? null
    }
  }

  return NextResponse.json({ topics, stats, has_more, next_cursor } satisfies GraveyardResponse)
}
