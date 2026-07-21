import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string | null
  }
}

export interface MarketArgumentsStats {
  total_for: number
  total_against: number
  avg_ai_score: number | null
  top_for_upvotes: number
  top_against_upvotes: number
}

export interface MarketArgumentsResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    total_votes: number
  }
  arguments: MarketArgument[]
  stats: MarketArgumentsStats
  total: number
  limit: number
  offset: number
}

// ─── Handler ──────────────────────────────────────────────────────────────────

const VALID_SIDES = ['all', 'for', 'against'] as const
const VALID_SORTS = ['top', 'new', 'quality'] as const
const MAX_LIMIT = 50

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const { searchParams } = req.nextUrl

  const side = (searchParams.get('side') ?? 'all') as (typeof VALID_SIDES)[number]
  const sort = (searchParams.get('sort') ?? 'top') as (typeof VALID_SORTS)[number]
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), MAX_LIMIT)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  if (!VALID_SIDES.includes(side) || !VALID_SORTS.includes(sort)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── 1. Validate topic ─────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  // ── 2. Stats (all sides) ──────────────────────────────────────────────────
  const { data: statsRows } = await supabase
    .from('topic_arguments')
    .select('side, upvotes, ai_score')
    .eq('topic_id', id)

  const allArgs = statsRows ?? []
  const forArgs = allArgs.filter((a) => a.side === 'blue')
  const againstArgs = allArgs.filter((a) => a.side === 'red')
  const scoredArgs = allArgs.filter((a) => a.ai_score != null)

  const stats: MarketArgumentsStats = {
    total_for: forArgs.length,
    total_against: againstArgs.length,
    avg_ai_score:
      scoredArgs.length > 0
        ? Math.round(
            (scoredArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / scoredArgs.length) * 10,
          ) / 10
        : null,
    top_for_upvotes: forArgs.length > 0 ? Math.max(...forArgs.map((a) => a.upvotes)) : 0,
    top_against_upvotes: againstArgs.length > 0 ? Math.max(...againstArgs.map((a) => a.upvotes)) : 0,
  }

  // ── 3. Paginated arguments ────────────────────────────────────────────────
  let query = supabase
    .from('topic_arguments')
    .select(
      `
      id, side, content, upvotes, ai_score, ai_grade, created_at,
      author:profiles!topic_arguments_user_id_fkey(
        username, display_name, avatar_url, role
      )
    `,
      { count: 'exact' },
    )
    .eq('topic_id', id)

  if (side === 'for') query = query.eq('side', 'blue')
  else if (side === 'against') query = query.eq('side', 'red')

  if (sort === 'top') {
    query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'quality') {
    query = query
      .order('ai_score', { ascending: false, nullsFirst: false })
      .order('upvotes', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: rawArgs, count, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const arguments_: MarketArgument[] = (rawArgs ?? []).map((r) => {
    const author = (r.author as Record<string, unknown> | null) ?? {}
    return {
      id: r.id as string,
      side: r.side as 'blue' | 'red',
      content: r.content as string,
      upvotes: (r.upvotes as number) ?? 0,
      ai_score: (r.ai_score as number | null) ?? null,
      ai_grade: (r.ai_grade as string | null) ?? null,
      created_at: r.created_at as string,
      author: {
        username: (author.username as string) ?? 'anonymous',
        display_name: (author.display_name as string | null) ?? null,
        avatar_url: (author.avatar_url as string | null) ?? null,
        role: (author.role as string | null) ?? null,
      },
    }
  })

  const response: MarketArgumentsResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    arguments: arguments_,
    stats,
    total: count ?? 0,
    limit,
    offset,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  })
}
