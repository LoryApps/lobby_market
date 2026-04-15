import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TopArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
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

export interface TopArgumentsResponse {
  arguments: TopArgument[]
  total: number
  limit: number
  offset: number
}

const VALID_PERIODS = ['week', 'month', 'all'] as const
const VALID_SIDES = ['for', 'against', 'all'] as const

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

/**
 * GET /api/arguments/top
 *
 * Returns the most-upvoted topic arguments platform-wide.
 *
 * Query params:
 *   period  — 'week' | 'month' | 'all'   (default: 'all')
 *   side    — 'for' | 'against' | 'all'  (default: 'all')
 *   category — one of CATEGORIES or ''   (default: '' = all)
 *   status  — 'active' | 'law' | ''      (default: '' = all)
 *   limit   — 1..50                      (default: 20)
 *   offset  — ≥0                         (default: 0)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const rawPeriod = searchParams.get('period') ?? 'all'
  const period = (VALID_PERIODS as readonly string[]).includes(rawPeriod)
    ? (rawPeriod as (typeof VALID_PERIODS)[number])
    : 'all'

  const rawSide = searchParams.get('side') ?? 'all'
  const side = (VALID_SIDES as readonly string[]).includes(rawSide)
    ? (rawSide as (typeof VALID_SIDES)[number])
    : 'all'

  const rawCategory = searchParams.get('category') ?? ''
  const category = CATEGORIES.includes(rawCategory) ? rawCategory : ''

  const rawStatus = searchParams.get('status') ?? ''
  const status = ['active', 'voting', 'law', 'proposed', 'failed'].includes(rawStatus)
    ? rawStatus
    : ''

  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20)
  )
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  const supabase = await createClient()

  // Build the arguments query
  let query = supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, created_at', {
      count: 'exact',
    })
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Side filter
  if (side === 'for') query = query.eq('side', 'blue')
  else if (side === 'against') query = query.eq('side', 'red')

  // Period filter
  if (period !== 'all') {
    const since = new Date()
    if (period === 'week') since.setDate(since.getDate() - 7)
    else if (period === 'month') since.setMonth(since.getMonth() - 1)
    query = query.gte('created_at', since.toISOString())
  }

  const { data: rawArgs, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  if (args.length === 0) {
    return NextResponse.json({
      arguments: [],
      total: count ?? 0,
      limit,
      offset,
    } satisfies TopArgumentsResponse)
  }

  // Batch-fetch topics and profiles
  const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))
  const userIds = Array.from(new Set(args.map((a) => a.user_id)))

  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  // Category filter applied at topic level
  if (category) topicsQuery = topicsQuery.eq('category', category)

  // Status filter applied at topic level
  type ValidTopicStatus = 'proposed' | 'active' | 'voting' | 'continued' | 'law' | 'failed'
  if (status) {
    topicsQuery = topicsQuery.eq('status', status as ValidTopicStatus)
  }

  const [topicsRes, profilesRes] = await Promise.all([
    topicsQuery,
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds),
  ])

  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id, t])
  )
  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  )

  // Filter out args whose topic didn't pass the category/status filter
  const filtered = args.filter((a) => topicMap.has(a.topic_id))

  const result: TopArgument[] = filtered.map((a) => ({
    id: a.id,
    topic_id: a.topic_id,
    user_id: a.user_id,
    side: a.side as 'blue' | 'red',
    content: a.content,
    upvotes: a.upvotes,
    created_at: a.created_at,
    author: profileMap.get(a.user_id) ?? null,
    topic: topicMap.get(a.topic_id) ?? null,
  }))

  return NextResponse.json({
    arguments: result,
    total: count ?? result.length,
    limit,
    offset,
  } satisfies TopArgumentsResponse)
}
