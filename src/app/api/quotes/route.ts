import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface QuoteEntry {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
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

export interface QuotesResponse {
  quotes: QuoteEntry[]
  total: number
}

/**
 * GET /api/quotes
 *
 * Returns the most memorable arguments platform-wide, sorted by upvotes.
 *
 * Query params:
 *   category  — category name or 'all' (default 'all')
 *   side      — 'for' | 'against' | 'all' (default 'all')
 *   period    — 'today' | 'week' | 'month' | 'all' (default 'week')
 *   sort      — 'upvotes' | 'ai_score' | 'recent' (default 'upvotes')
 *   limit     — max 60 (default 30)
 *   offset    — pagination offset (default 0)
 *   min_length — minimum argument character length (default 100)
 *   max_length — max argument length to show (default 600)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? 'all'
  const side = searchParams.get('side') ?? 'all'
  const period = searchParams.get('period') ?? 'week'
  const sort = searchParams.get('sort') ?? 'upvotes'
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '30'), 60)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 30
  const rawOffset = Number(searchParams.get('offset') ?? '0')
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0
  const minLength = Number(searchParams.get('min_length') ?? '80')

  const supabase = await createClient()

  // ── Time window ────────────────────────────────────────────────────────────
  let since: string | null = null
  const now = new Date()
  if (period === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    since = d.toISOString()
  } else if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    since = d.toISOString()
  } else if (period === 'month') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    since = d.toISOString()
  }

  // ── Query ──────────────────────────────────────────────────────────────────
  let query = supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes, ai_score, ai_grade, created_at, user_id', { count: 'exact' })
    .gte('upvotes', 1)

  if (since) query = query.gte('created_at', since)
  if (side === 'for') query = query.eq('side', 'blue')
  else if (side === 'against') query = query.eq('side', 'red')

  // Sort
  if (sort === 'ai_score') {
    query = query.order('ai_score', { ascending: false, nullsFirst: false })
      .order('upvotes', { ascending: false })
  } else if (sort === 'recent') {
    query = query.order('created_at', { ascending: false })
  } else {
    // default: upvotes
    query = query.order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: rows, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ quotes: [], total: 0 } satisfies QuotesResponse)
  }

  // Filter by minimum length
  const filtered = rows.filter((r) => r.content.length >= minLength)

  // ── Join authors + topics ─────────────────────────────────────────────────
  const userIdSet = new Set(filtered.map((r) => r.user_id))
  const topicIdSet = new Set(filtered.map((r) => r.topic_id))

  const [authorsRes, topicsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', Array.from(userIdSet)),
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', Array.from(topicIdSet)),
  ])

  const authorMap = new Map((authorsRes.data ?? []).map((a) => [a.id, a]))
  let topicList = topicsRes.data ?? []

  // Post-filter by category
  if (category !== 'all') {
    const catSet = new Set(topicList.filter((t) => t.category === category).map((t) => t.id))
    topicList = topicList.filter((t) => catSet.has(t.id))
  }
  const topicMap = new Map(topicList.map((t) => [t.id, t]))

  const quotes: QuoteEntry[] = filtered
    .filter((r) => topicMap.has(r.topic_id))
    .map((row) => ({
      id: row.id,
      topic_id: row.topic_id,
      side: row.side as 'blue' | 'red',
      content: row.content,
      upvotes: row.upvotes,
      ai_score: row.ai_score ?? null,
      ai_grade: row.ai_grade ?? null,
      created_at: row.created_at,
      author: authorMap.get(row.user_id) ?? null,
      topic: topicMap.get(row.topic_id) ?? null,
    }))

  return NextResponse.json({ quotes, total: count ?? quotes.length } satisfies QuotesResponse)
}
