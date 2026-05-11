import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscussedArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  latest_reply_at: string | null
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface DiscussionsResponse {
  arguments: DiscussedArgument[]
  total: number
  sort: string
  generatedAt: string
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const VALID_SORTS = ['most_replies', 'recent_activity', 'most_active'] as const
type Sort = typeof VALID_SORTS[number]

/**
 * GET /api/arguments/discussions
 *
 * Returns arguments ranked by discussion activity (reply count / recency).
 * Makes it easy to discover active reply threads across the platform.
 *
 * Query params:
 *   sort     — most_replies | recent_activity | most_active (default: most_replies)
 *   category — filter by topic category (optional)
 *   side     — 'for' | 'against' | '' (default: both)
 *   days     — look-back window 1–365 (default: 30)
 *   limit    — 1–30 (default: 20)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category') ?? ''
  const rawSort = searchParams.get('sort') ?? 'most_replies'
  const rawSide = searchParams.get('side') ?? ''
  const rawDays = parseInt(searchParams.get('days') ?? '30', 10)
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)

  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : ''
  const sort: Sort = (VALID_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as Sort)
    : 'most_replies'
  const side = rawSide === 'for' ? 'blue' : rawSide === 'against' ? 'red' : ''
  const days = Math.min(365, Math.max(1, isNaN(rawDays) ? 30 : rawDays))
  const limit = Math.min(30, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit))

  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - days)

  // Step 1: Get argument IDs with their reply stats from the last N days
  // We fetch all replies in the window and aggregate in memory
  const { data: replyRows, error: replyError } = await supabase
    .from('argument_replies')
    .select('argument_id, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000)

  if (replyError) {
    return NextResponse.json({ error: replyError.message }, { status: 500 })
  }

  if (!replyRows?.length) {
    return NextResponse.json({
      arguments: [],
      total: 0,
      sort,
      generatedAt: new Date().toISOString(),
    } satisfies DiscussionsResponse)
  }

  // Aggregate reply stats per argument
  type ReplyStats = { count: number; latestAt: string }
  const replyStatsMap = new Map<string, ReplyStats>()

  for (const row of replyRows) {
    const existing = replyStatsMap.get(row.argument_id)
    if (!existing) {
      replyStatsMap.set(row.argument_id, { count: 1, latestAt: row.created_at })
    } else {
      existing.count++
      if (row.created_at > existing.latestAt) existing.latestAt = row.created_at
    }
  }

  // Sort argument IDs by the requested sort mode
  let sortedIds: string[]
  if (sort === 'most_replies') {
    sortedIds = [...replyStatsMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id]) => id)
  } else if (sort === 'recent_activity') {
    sortedIds = [...replyStatsMap.entries()]
      .sort((a, b) => b[1].latestAt.localeCompare(a[1].latestAt))
      .map(([id]) => id)
  } else {
    // most_active: combined score of replies × recency
    const now = Date.now()
    sortedIds = [...replyStatsMap.entries()]
      .sort((a, b) => {
        const scoreA = a[1].count / Math.max(1, (now - new Date(a[1].latestAt).getTime()) / 3_600_000)
        const scoreB = b[1].count / Math.max(1, (now - new Date(b[1].latestAt).getTime()) / 3_600_000)
        return scoreB - scoreA
      })
      .map(([id]) => id)
  }

  // Take top candidates (over-fetch to allow category/side filtering below)
  const candidateIds = sortedIds.slice(0, Math.min(sortedIds.length, limit * 4))

  // Step 2: Fetch argument details for the candidate IDs
  let argQuery = supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, ai_score, ai_grade, created_at')
    .in('id', candidateIds)

  if (side) argQuery = argQuery.eq('side', side)

  const { data: argRows, error: argError } = await argQuery

  if (argError) {
    return NextResponse.json({ error: argError.message }, { status: 500 })
  }

  if (!argRows?.length) {
    return NextResponse.json({
      arguments: [],
      total: 0,
      sort,
      generatedAt: new Date().toISOString(),
    } satisfies DiscussionsResponse)
  }

  // Step 3: Fetch author profiles
  const userIds = [...new Set(argRows.map((a) => a.user_id))]
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p])
  )

  // Step 4: Fetch topic details
  const topicIds = [...new Set(argRows.map((a) => a.topic_id))]
  let topicQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  if (category) topicQuery = topicQuery.eq('category', category)

  const { data: topicRows } = await topicQuery

  const topicMap = new Map(
    (topicRows ?? []).map((t) => [t.id, t])
  )

  // Build result list (preserve candidate sort order, apply category filter)
  const idOrder = new Map(candidateIds.map((id, i) => [id, i]))

  const assembled: DiscussedArgument[] = argRows
    .filter((a) => {
      if (category && !topicMap.has(a.topic_id)) return false
      return true
    })
    .sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999))
    .slice(0, limit)
    .map((a) => {
      const stats = replyStatsMap.get(a.id)
      return {
        id: a.id,
        topic_id: a.topic_id,
        user_id: a.user_id,
        side: a.side as 'blue' | 'red',
        content: a.content,
        upvotes: a.upvotes,
        reply_count: stats?.count ?? 0,
        latest_reply_at: stats?.latestAt ?? null,
        ai_score: a.ai_score,
        ai_grade: a.ai_grade,
        created_at: a.created_at,
        author: profileMap.get(a.user_id) ?? null,
        topic: topicMap.get(a.topic_id) ?? null,
      }
    })

  return NextResponse.json({
    arguments: assembled,
    total: replyStatsMap.size,
    sort,
    generatedAt: new Date().toISOString(),
  } satisfies DiscussionsResponse)
}
