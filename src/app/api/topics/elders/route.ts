import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ElderTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  created_at: string
  /** Days since the topic was first proposed */
  days_alive: number
  /** Total arguments posted on this topic */
  argument_count: number
  /** Distance from 50/50 — higher means stronger consensus */
  consensus_pct: number
}

export interface EldersStats {
  total_elders: number
  oldest_days: number
  oldest_id: string | null
  oldest_statement: string | null
  avg_days_alive: number
  total_votes_across: number
}

export interface EldersResponse {
  topics: ElderTopic[]
  stats: EldersStats
  min_days: number
  generated_at: string
  has_more: boolean
}

// ─── Config ────────────────────────────────────────────────────────────────────

/** A topic must be at least this old to appear in the Elders feed */
const MIN_DAYS_ALIVE = 30
const MAX_RESULTS = 50

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const sort = searchParams.get('sort') ?? 'age' // 'age' | 'votes' | 'consensus'
  const category = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), MAX_RESULTS)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const now = Date.now()
  const cutoff = new Date(now - MIN_DAYS_ALIVE * 24 * 60 * 60 * 1000).toISOString()

  const emptyResponse: EldersResponse = {
    topics: [],
    stats: {
      total_elders: 0,
      oldest_days: 0,
      oldest_id: null,
      oldest_statement: null,
      avg_days_alive: 0,
      total_votes_across: 0,
    },
    min_days: MIN_DAYS_ALIVE,
    generated_at: new Date().toISOString(),
    has_more: false,
  }

  // ── 1. Fetch unresolved topics older than MIN_DAYS_ALIVE ─────────────────

  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, created_at')
    .in('status', ['proposed', 'active', 'voting'])
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(300)

  if (category) query = query.eq('category', category)

  const { data: topics, error } = await query
  if (error || !topics?.length) {
    return NextResponse.json(emptyResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // ── 2. Argument counts per topic ─────────────────────────────────────────

  const { data: argRows } = await supabase
    .from('arguments')
    .select('topic_id')
    .in('topic_id', topicIds)

  const argCountMap: Record<string, number> = {}
  for (const a of argRows ?? []) {
    argCountMap[a.topic_id] = (argCountMap[a.topic_id] ?? 0) + 1
  }

  // ── 3. Build ElderTopic records ──────────────────────────────────────────

  const elders: ElderTopic[] = topics.map((t) => {
    const daysAlive = Math.floor(
      (now - new Date(t.created_at).getTime()) / (24 * 60 * 60 * 1000),
    )
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      scope: t.scope,
      created_at: t.created_at,
      days_alive: daysAlive,
      argument_count: argCountMap[t.id] ?? 0,
      consensus_pct: Math.abs((t.blue_pct ?? 50) - 50),
    }
  })

  // ── 4. Sort ──────────────────────────────────────────────────────────────

  if (sort === 'age') {
    elders.sort((a, b) => b.days_alive - a.days_alive)
  } else if (sort === 'votes') {
    elders.sort((a, b) => b.total_votes - a.total_votes)
  } else if (sort === 'consensus') {
    elders.sort((a, b) => b.consensus_pct - a.consensus_pct)
  }

  // ── 5. Stats (computed on the full sorted set before pagination) ─────────

  const oldestFirst = [...elders].sort((a, b) => b.days_alive - a.days_alive)
  const oldest = oldestFirst[0] ?? null

  const stats: EldersStats = {
    total_elders: elders.length,
    oldest_days: oldest?.days_alive ?? 0,
    oldest_id: oldest?.id ?? null,
    oldest_statement: oldest?.statement ?? null,
    avg_days_alive:
      elders.length > 0
        ? Math.round(elders.reduce((s, t) => s + t.days_alive, 0) / elders.length)
        : 0,
    total_votes_across: elders.reduce((s, t) => s + t.total_votes, 0),
  }

  const page = elders.slice(offset, offset + limit)

  return NextResponse.json({
    topics: page,
    stats,
    min_days: MIN_DAYS_ALIVE,
    generated_at: new Date().toISOString(),
    has_more: offset + limit < elders.length,
  } satisfies EldersResponse)
}
