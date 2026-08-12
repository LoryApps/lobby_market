import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface MapArgument {
  id: string
  topic_id: string
  topic_statement: string
  category: string | null
  side: 'for' | 'against'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  author_username: string
  author_display_name: string | null
  created_at: string
}

export interface ArgumentMapResponse {
  arguments: MapArgument[]
  stats: {
    total: number
    for_count: number
    against_count: number
    avg_score: number | null
    max_upvotes: number
    with_score: number
  }
  categories: string[]
}

const COLS = `
  id,
  topic_id,
  side,
  content,
  upvotes,
  ai_score,
  ai_grade,
  created_at,
  topics!inner (
    statement,
    category
  ),
  profiles!topic_arguments_author_id_fkey (
    username,
    display_name
  )
`

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const side = searchParams.get('side') ?? null

  let query = supabase
    .from('topic_arguments')
    .select(COLS)
    .gte('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(500)

  if (side === 'for' || side === 'against') {
    query = query.eq('side', side)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Array<{
    id: string
    topic_id: string
    side: string
    content: string
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    topics: { statement: string; category: string | null } | null
    profiles: { username: string; display_name: string | null } | null
  }>

  const args: MapArgument[] = rows
    .filter((r) => {
      if (category && r.topics?.category !== category) return false
      return true
    })
    .map((r) => ({
      id: r.id,
      topic_id: r.topic_id,
      topic_statement: r.topics?.statement ?? '',
      category: r.topics?.category ?? null,
      side: r.side as 'for' | 'against',
      content: r.content,
      upvotes: r.upvotes,
      ai_score: r.ai_score,
      ai_grade: r.ai_grade,
      author_username: r.profiles?.username ?? 'citizen',
      author_display_name: r.profiles?.display_name ?? null,
      created_at: r.created_at,
    }))

  const withScore = args.filter((a) => a.ai_score !== null)
  const totalScore = withScore.reduce((s, a) => s + (a.ai_score ?? 0), 0)

  const categories = Array.from(
    new Set(args.map((a) => a.category).filter(Boolean) as string[])
  ).sort()

  const stats = {
    total: args.length,
    for_count: args.filter((a) => a.side === 'for').length,
    against_count: args.filter((a) => a.side === 'against').length,
    avg_score: withScore.length > 0 ? Math.round(totalScore / withScore.length) : null,
    max_upvotes: args.reduce((m, a) => Math.max(m, a.upvotes), 0),
    with_score: withScore.length,
  }

  return NextResponse.json({ arguments: args, stats, categories })
}
