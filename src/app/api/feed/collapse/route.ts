import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/collapse
 *
 * Topics where the FOR consensus has dropped the most over the last 7 days.
 * Identifies debates where public opinion has dramatically shifted against
 * a previously winning position — the most dramatic opinion reversals on
 * the platform right now.
 *
 * Strategy:
 *   1. Pull price history snapshots from the last 7 days per topic.
 *   2. For each topic, compute delta = earliest_price − latest_price
 *      (positive delta = FOR% dropped, i.e. a "collapse").
 *   3. Only include topics with a drop ≥ 3pp AND where the starting price
 *      was ≥ 52% (so we exclude already-losing topics that kept losing).
 *   4. Fall back to topics with status changes when history is sparse.
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "top" (largest drop) | "new" | "hot" (default "top")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  // ── Step 1: Pull 7-day price history snapshots ─────────────────────────────
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: snapshots, error: snapError } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .gte('recorded_at', since7d)
    .order('recorded_at', { ascending: true })

  // ── Step 2: Compute per-topic delta from snapshot history ─────────────────
  const topicDropMap = new Map<string, { earliest: number; latest: number; drop: number }>()

  if (!snapError && snapshots && snapshots.length > 0) {
    for (const row of snapshots) {
      const existing = topicDropMap.get(row.topic_id)
      if (!existing) {
        topicDropMap.set(row.topic_id, { earliest: row.price, latest: row.price, drop: 0 })
      } else {
        existing.latest = row.price
        existing.drop = existing.earliest - existing.latest
      }
    }
  }

  // Collect topic IDs with meaningful drops (≥ 3pp, started ≥ 52% FOR)
  const droppedIds = Array.from(topicDropMap.entries())
    .filter(([, v]) => v.drop >= 3 && v.earliest >= 52)
    .sort(([, a], [, b]) => b.drop - a.drop)
    .map(([id]) => id)

  // ── Step 3: Fetch topic data ───────────────────────────────────────────────
  let topicData: TopicWithAuthor[] = []

  if (droppedIds.length > 0) {
    const fetchIds = droppedIds.slice(0, Math.min(200, droppedIds.length))

    const { data, error } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          role,
          clout
        )
      `)
      .in('id', fetchIds)
      .in('status', ['active', 'voting', 'proposed'])

    if (!error && data) {
      // Preserve drop-magnitude order from droppedIds
      const idOrder = new Map(droppedIds.map((id, i) => [id, i]))
      topicData = (data as TopicWithAuthor[]).sort(
        (a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999)
      )
    }
  }

  // ── Step 4: Fallback — topics that flipped minority status recently ────────
  // When price history is sparse, surface the most-contested topics that
  // are currently losing (< 50%) but were recently winning — approximated
  // by high total_votes + blue_pct in [38, 49].
  if (topicData.length < 10) {
    const { data: fallback } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          role,
          clout
        )
      `)
      .in('status', ['active', 'voting'])
      .gte('blue_pct', 35)
      .lt('blue_pct', 49)
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(50)

    if (fallback) {
      const existingIds = new Set(topicData.map((t) => t.id))
      const extras = (fallback as TopicWithAuthor[]).filter((t) => !existingIds.has(t.id))
      topicData = [...topicData, ...extras]
    }
  }

  // ── Step 5: Sort and paginate ─────────────────────────────────────────────
  if (sort === 'new') {
    topicData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (sort === 'hot') {
    topicData.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
  }
  // "top" keeps the drop-magnitude order from Step 3

  const page = topicData.slice(offset, offset + limit)
  const hasMore = topicData.length > offset + limit

  // Attach drop metadata to each topic for display
  const topicsWithDrop = page.map((t) => ({
    ...t,
    _collapse_drop: topicDropMap.get(t.id)?.drop ?? null,
    _collapse_start: topicDropMap.get(t.id)?.earliest ?? null,
  }))

  return NextResponse.json({
    topics: topicsWithDrop,
    hasMore,
    total: topicData.length,
  })
}

// ── Type helpers ──────────────────────────────────────────────────────────────

interface AuthorProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

interface TopicWithAuthor {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  blue_votes: number
  red_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  created_at: string
  updated_at: string
  author_id: string
  feed_score: number
  tags: string[] | null
  author: AuthorProfile | null
}
