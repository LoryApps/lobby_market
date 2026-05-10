import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type Period = 'week' | 'month' | 'all'
export type GradeFilter = 'all' | 'A' | 'B' | 'C'
export type SideFilter = 'all' | 'for' | 'against'

export interface TopScoredArgument {
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
  } | null
}

export interface TopScoredResponse {
  arguments: TopScoredArgument[]
  total: number
}

const PERIOD_CUTOFFS: Record<Period, string | null> = {
  week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  all: null,
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const period = (searchParams.get('period') ?? 'all') as Period
  const grade = (searchParams.get('grade') ?? 'all') as GradeFilter
  const side = (searchParams.get('side') ?? 'all') as SideFilter
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('topic_arguments')
    .select(
      `
      id, topic_id, user_id, side, content, upvotes, source_url, ai_score, ai_grade, created_at,
      author:profiles!user_id ( id, username, display_name, avatar_url, role ),
      topic:topics!topic_id ( id, statement, category, status )
    `,
      { count: 'exact' },
    )
    .not('ai_score', 'is', null)
    .not('ai_grade', 'is', null)
    .order('ai_score', { ascending: false })
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const cutoff = PERIOD_CUTOFFS[period] ?? null
  if (cutoff) query = query.gte('created_at', cutoff)

  if (grade !== 'all') query = query.eq('ai_grade', grade)

  if (side === 'for') query = query.eq('side', 'blue')
  else if (side === 'against') query = query.eq('side', 'red')

  const { data, error, count } = await query

  if (error) {
    console.error('[top-scored] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to load arguments' }, { status: 500 })
  }

  const args = (data ?? []).map((row) => ({
    ...row,
    ai_score: row.ai_score as number,
    ai_grade: row.ai_grade as string,
    author: Array.isArray(row.author) ? row.author[0] ?? null : (row.author as TopScoredArgument['author']),
    topic: Array.isArray(row.topic) ? row.topic[0] ?? null : (row.topic as TopScoredArgument['topic']),
  })) as TopScoredArgument[]

  return NextResponse.json({ arguments: args, total: count ?? 0 } satisfies TopScoredResponse)
}
