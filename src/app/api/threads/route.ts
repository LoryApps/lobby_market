import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThreadTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
}

export interface CivicThread {
  tag: string
  topic_count: number
  active_count: number
  law_count: number
  failed_count: number
  total_votes: number
  avg_blue_pct: number
  controversy_score: number   // 0–100; 100 = perfectly split across all topics
  activity_score: number      // composite ranking score
  categories: string[]        // unique categories in this thread
  top_topics: ThreadTopic[]   // up to 3 topics for preview
  last_activity: string       // ISO date of most recently created topic
}

export interface ThreadsResponse {
  threads: CivicThread[]
  total: number
  sort: string
  category_filter: string | null
}

// ─── GET /api/threads ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category')?.trim() ?? ''
  const rawSort = searchParams.get('sort') ?? 'activity'
  const rawLimit = parseInt(searchParams.get('limit') ?? '24', 10)
  const rawMinTopics = parseInt(searchParams.get('min_topics') ?? '3', 10)

  const VALID_CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
    'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null
  const sort = ['activity', 'votes', 'size', 'contested'].includes(rawSort) ? rawSort : 'activity'
  const limit = Math.min(Math.max(rawLimit, 6), 50)
  const minTopics = Math.min(Math.max(rawMinTopics, 2), 10)

  const supabase = await createClient()

  // Fetch topics with tags — up to 2000 to cover most of the platform
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, tags, created_at')
    .not('tags', 'eq', '{}')
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .order('total_votes', { ascending: false })
    .limit(2000)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: rows, error } = await query

  if (error || !rows?.length) {
    return NextResponse.json<ThreadsResponse>({
      threads: [],
      total: 0,
      sort,
      category_filter: category,
    })
  }

  // ── Group by tag ──────────────────────────────────────────────────────────

  interface TagAccumulator {
    topics: Array<{
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
      created_at: string
    }>
    total_votes: number
    blue_pct_sum: number
    categories: Set<string>
    last_activity: string
  }

  const tagMap = new Map<string, TagAccumulator>()

  for (const row of rows) {
    const tags: string[] = row.tags ?? []
    for (const tag of tags) {
      if (!tag) continue
      const existing: TagAccumulator = tagMap.get(tag) ?? {
        topics: [],
        total_votes: 0,
        blue_pct_sum: 0,
        categories: new Set(),
        last_activity: row.created_at ?? '',
      }

      existing.topics.push({
        id: row.id,
        statement: row.statement,
        category: row.category,
        status: row.status,
        blue_pct: row.blue_pct ?? 50,
        total_votes: row.total_votes ?? 0,
        created_at: row.created_at ?? '',
      })

      existing.total_votes += row.total_votes ?? 0
      existing.blue_pct_sum += row.blue_pct ?? 50
      if (row.category) existing.categories.add(row.category)
      if ((row.created_at ?? '') > existing.last_activity) {
        existing.last_activity = row.created_at ?? ''
      }

      tagMap.set(tag, existing)
    }
  }

  // ── Build thread objects ──────────────────────────────────────────────────

  const threads: CivicThread[] = []

  for (const [tag, acc] of tagMap.entries()) {
    if (acc.topics.length < minTopics) continue

    const topic_count = acc.topics.length
    const active_count = acc.topics.filter(
      (t) => t.status === 'active' || t.status === 'voting',
    ).length
    const law_count = acc.topics.filter((t) => t.status === 'law').length
    const failed_count = acc.topics.filter((t) => t.status === 'failed').length

    const avg_blue_pct = acc.blue_pct_sum / topic_count

    // Controversy: average distance from 50% — closer to 0 = more controversial
    // Score 0–100 where 100 = perfectly split (avg_blue_pct = 50)
    const avg_distance = Math.abs(avg_blue_pct - 50)
    const controversy_score = Math.round(100 - avg_distance * 2)

    // Activity score: active_count weight + log vote mass + recency bonus
    const log_votes = Math.log1p(acc.total_votes)
    const recency_days =
      (Date.now() - new Date(acc.last_activity).getTime()) / 86_400_000
    const recency_bonus = Math.max(0, 30 - recency_days)
    const activity_score = active_count * 15 + log_votes * 3 + recency_bonus

    // Top topics: sort by total_votes desc, take top 3
    const top_topics = [...acc.topics]
      .sort((a, b) => b.total_votes - a.total_votes)
      .slice(0, 3) satisfies ThreadTopic[]

    threads.push({
      tag,
      topic_count,
      active_count,
      law_count,
      failed_count,
      total_votes: acc.total_votes,
      avg_blue_pct,
      controversy_score,
      activity_score,
      categories: Array.from(acc.categories),
      top_topics,
      last_activity: acc.last_activity,
    })
  }

  // ── Sort ──────────────────────────────────────────────────────────────────

  switch (sort) {
    case 'votes':
      threads.sort((a, b) => b.total_votes - a.total_votes)
      break
    case 'size':
      threads.sort((a, b) => b.topic_count - a.topic_count || b.total_votes - a.total_votes)
      break
    case 'contested':
      threads.sort((a, b) => b.controversy_score - a.controversy_score || b.total_votes - a.total_votes)
      break
    case 'activity':
    default:
      threads.sort((a, b) => b.activity_score - a.activity_score)
      break
  }

  return NextResponse.json<ThreadsResponse>({
    threads: threads.slice(0, limit),
    total: threads.length,
    sort,
    category_filter: category,
  })
}
