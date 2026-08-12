import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type GradeFilter = 'all' | 'A' | 'B'
export type SideFilter = 'all' | 'for' | 'against'
export type Period = 'week' | 'month' | 'all'

export interface UnderratedArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  source_url: string | null
  ai_score: number
  ai_grade: string
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

export interface UnderratedResponse {
  arguments: UnderratedArgument[]
  total: number
  categories: string[]
}

const PERIOD_CUTOFFS: Record<Period, string | null> = {
  week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  all: null,
}

// Hidden gem = high quality (ai_score >= 6) but low upvotes (< 15)
// Ordered by ai_score DESC so A-grade gems surface first
const MIN_SCORE = 6
const MAX_UPVOTES = 15

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const period = (searchParams.get('period') ?? 'all') as Period
  const grade = (searchParams.get('grade') ?? 'all') as GradeFilter
  const side = (searchParams.get('side') ?? 'all') as SideFilter
  const category = searchParams.get('category') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('topic_arguments')
    .select(
      `
      id, topic_id, user_id, side, content, upvotes, source_url, ai_score, ai_grade, created_at,
      author:profiles!user_id ( id, username, display_name, avatar_url, role ),
      topic:topics!topic_id ( id, statement, category, status, blue_pct, total_votes )
    `,
      { count: 'exact' },
    )
    .not('ai_score', 'is', null)
    .not('ai_grade', 'is', null)
    .gte('ai_score', MIN_SCORE)
    .lte('upvotes', MAX_UPVOTES)
    .order('ai_score', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const cutoff = PERIOD_CUTOFFS[period] ?? null
  if (cutoff) query = query.gte('created_at', cutoff)

  if (grade === 'A') query = query.eq('ai_grade', 'A')
  else if (grade === 'B') query = query.in('ai_grade', ['A', 'B'])

  if (side === 'for') query = query.eq('side', 'blue')
  else if (side === 'against') query = query.eq('side', 'red')

  const { data, error, count } = await query

  if (error) {
    console.error('[underrated] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to load arguments' }, { status: 500 })
  }

  const args = (data ?? []).map((row) => ({
    ...row,
    ai_score: row.ai_score as number,
    ai_grade: row.ai_grade as string,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : (row.author as UnderratedArgument['author']),
    topic: Array.isArray(row.topic) ? (row.topic[0] ?? null) : (row.topic as UnderratedArgument['topic']),
  })) as UnderratedArgument[]

  // Filter by category after join (Supabase doesn't support filtering on joined columns in range queries easily)
  const filtered = category !== 'all'
    ? args.filter((a) => a.topic?.category === category)
    : args

  // Collect unique categories from result for filter pills
  const catSet = new Set<string>()
  for (const a of args) {
    if (a.topic?.category) catSet.add(a.topic.category)
  }
  const categories = Array.from(catSet).sort()

  return NextResponse.json({
    arguments: filtered,
    total: count ?? 0,
    categories,
  } satisfies UnderratedResponse)
}
