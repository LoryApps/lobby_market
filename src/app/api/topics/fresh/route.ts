import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FreshTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  created_at: string
  /** Hours since the topic was created */
  age_hours: number
  /** Votes per hour since creation */
  votes_per_hour: number
  /** Total argument count */
  arg_count: number
  /** Age tier: 'new' (< 24h) | 'fresh' (1–3d) | 'recent' (3–7d) | 'week' (7–14d) */
  age_tier: 'new' | 'fresh' | 'recent' | 'week'
}

export interface FreshTopicsResponse {
  topics: FreshTopic[]
  total: number
  categories: string[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Topics must be at most this many days old */
const MAX_AGE_DAYS = 14
/** Minimum votes to have enough signal */
const MIN_VOTES = 3
/** Maximum results */
const MAX_RESULTS = 60

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

function ageTier(hours: number): FreshTopic['age_tier'] {
  if (hours < 24) return 'new'
  if (hours < 72) return 'fresh'
  if (hours < 168) return 'recent'
  return 'week'
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? 'all'
  const sort = (searchParams.get('sort') ?? 'velocity') as
    | 'velocity'
    | 'newest'
    | 'votes'
    | 'argued'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), MAX_RESULTS)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Fetch fresh topics ─────────────────────────────────────────────────
  let q = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, created_at')
    .gte('created_at', cutoff)
    .in('status', ['proposed', 'active', 'voting'])
    .gte('total_votes', MIN_VOTES)
    .limit(1000)

  if (category !== 'all' && CATEGORIES.includes(category)) {
    q = q.eq('category', category)
  }

  const { data: topicRows, error: topicErr } = await q

  if (topicErr) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  if (!topicRows || topicRows.length === 0) {
    return NextResponse.json({
      topics: [],
      total: 0,
      categories: CATEGORIES,
    } satisfies FreshTopicsResponse)
  }

  // ── 2. Fetch argument counts for these topics ─────────────────────────────
  const topicIds = topicRows.map((t) => t.id)
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .in('topic_id', topicIds)
    .limit(100_000)

  const argCounts: Record<string, number> = {}
  for (const row of argRows ?? []) {
    argCounts[row.topic_id] = (argCounts[row.topic_id] ?? 0) + 1
  }

  // ── 3. Compute metrics ────────────────────────────────────────────────────
  const now = Date.now()

  const results: FreshTopic[] = topicRows.map((topic) => {
    const createdMs = new Date(topic.created_at).getTime()
    const age_hours = Math.max((now - createdMs) / 3_600_000, 0.5) // floor 0.5h to avoid div/0
    const votes_per_hour = (topic.total_votes ?? 0) / age_hours
    const arg_count = argCounts[topic.id] ?? 0

    return {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: Math.round(topic.blue_pct ?? 50),
      total_votes: topic.total_votes ?? 0,
      scope: topic.scope,
      created_at: topic.created_at,
      age_hours: Math.round(age_hours * 10) / 10,
      votes_per_hour: Math.round(votes_per_hour * 100) / 100,
      arg_count,
      age_tier: ageTier(age_hours),
    }
  })

  // ── 4. Sort ────────────────────────────────────────────────────────────────
  if (sort === 'newest') {
    results.sort((a, b) => a.age_hours - b.age_hours)
  } else if (sort === 'votes') {
    results.sort((a, b) => b.total_votes - a.total_votes)
  } else if (sort === 'argued') {
    results.sort((a, b) => b.arg_count - a.arg_count)
  } else {
    // Default: velocity (votes per hour)
    results.sort((a, b) => b.votes_per_hour - a.votes_per_hour)
  }

  const paginated = results.slice(offset, offset + limit)

  return NextResponse.json({
    topics: paginated,
    total: results.length,
    categories: CATEGORIES,
  } satisfies FreshTopicsResponse)
}
