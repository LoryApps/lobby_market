import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 60

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'law_established'
  | 'topic_failed'
  | 'topic_activated'
  | 'topic_voting'
  | 'topic_proposed'
  | 'debate_ended'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  occurred_at: string
  topic_id?: string
  topic_statement?: string
  topic_category?: string | null
  topic_blue_pct?: number
  topic_total_votes?: number
  debate_id?: string
  debate_title?: string
  debate_type?: string
}

export interface TimelineResponse {
  events: TimelineEvent[]
  next_cursor: string | null
  total: number
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor') ?? undefined
  const limit = Math.min(
    parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10),
    MAX_LIMIT
  )
  const typeFilter = searchParams.get('type') ?? 'all'
  const categoryFilter = searchParams.get('category') ?? 'all'

  const supabase = await createClient()
  const events: TimelineEvent[] = []

  // --- Topic events ---
  // We treat `updated_at` as the event time for status changes.
  // For 'law' and 'failed' topics this reflects when they resolved.
  if (typeFilter === 'all' || typeFilter === 'laws' || typeFilter === 'topics') {
    const statusList =
      typeFilter === 'laws'
        ? (['law'] as const)
        : (['law', 'failed', 'active', 'voting'] as const)

    let topicQuery = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('status', statusList)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (categoryFilter !== 'all') {
      topicQuery = topicQuery.eq('category', categoryFilter)
    }
    if (cursor) {
      topicQuery = topicQuery.lt('updated_at', cursor)
    }

    const { data: topicRows } = await topicQuery

    for (const t of topicRows ?? []) {
      let type: TimelineEventType
      switch (t.status) {
        case 'law':     type = 'law_established'; break
        case 'failed':  type = 'topic_failed';    break
        case 'active':  type = 'topic_activated'; break
        case 'voting':  type = 'topic_voting';    break
        default:        type = 'topic_proposed'
      }

      events.push({
        id: `topic-${t.id}`,
        type,
        occurred_at: t.updated_at,
        topic_id: t.id,
        topic_statement: t.statement,
        topic_category: t.category,
        topic_blue_pct: t.blue_pct,
        topic_total_votes: t.total_votes,
      })
    }
  }

  // --- Debate events ---
  if (typeFilter === 'all' || typeFilter === 'debates') {
    let debateQuery = supabase
      .from('debates')
      .select('id, title, type, topic_id, ended_at')
      .eq('status', 'ended')
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(100)

    if (cursor) {
      debateQuery = debateQuery.lt('ended_at', cursor)
    }

    const { data: debateRows } = await debateQuery

    if (debateRows && debateRows.length > 0) {
      // Fetch topics for debates in a single query
      const topicIds = Array.from(new Set(debateRows.map((d) => d.topic_id)))
      const { data: topicRows } = await supabase
        .from('topics')
        .select('id, statement, category')
        .in('id', topicIds)

      const topicMap = new Map<string, { id: string; statement: string; category: string | null }>()
      for (const t of topicRows ?? []) {
        topicMap.set(t.id, t)
      }

      for (const d of debateRows) {
        const topic = topicMap.get(d.topic_id)

        // Apply category filter client-side (since we fetched topics separately)
        if (categoryFilter !== 'all' && topic?.category !== categoryFilter) continue

        events.push({
          id: `debate-${d.id}`,
          type: 'debate_ended',
          occurred_at: d.ended_at!,
          debate_id: d.id,
          debate_title: d.title,
          debate_type: d.type,
          topic_id: topic?.id,
          topic_statement: topic?.statement,
          topic_category: topic?.category,
        })
      }
    }
  }

  // Sort all events newest-first, then paginate
  events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  const paginated = events.slice(0, limit)
  const next_cursor =
    paginated.length === limit ? paginated[paginated.length - 1].occurred_at : null

  return NextResponse.json({
    events: paginated,
    next_cursor,
    total: events.length,
  } satisfies TimelineResponse)
}
