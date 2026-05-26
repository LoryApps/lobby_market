import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type HallTab = 'architects' | 'dissent'
export type CategoryFilter = string | 'all'

export interface HallArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  source_url: string | null
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  composite_score: number
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

export interface HallResponse {
  arguments: HallArgument[]
  total: number
  categories: string[]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const tab = (searchParams.get('tab') ?? 'architects') as HallTab
  const category = searchParams.get('category') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 48)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  // For "architects": FOR (blue) arguments on topics that became law
  // For "dissent": AGAINST (red) arguments on topics that became law (honourable losses)
  const side = tab === 'architects' ? 'blue' : 'red'

  // Fetch available categories first (for filter chips)
  const { data: catData } = await supabase
    .from('topics')
    .select('category')
    .eq('status', 'law')
    .not('category', 'is', null)
  const categories = [...new Set((catData ?? []).map((r) => r.category as string))].sort()

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
    .eq('side', side)
    // Only arguments on topics that became law
    .eq('topic.status', 'law')
    .not('topic', 'is', null)
    // Prefer graded arguments first, then high upvotes
    .order('ai_score', { ascending: false, nullsFirst: false })
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category !== 'all') {
    query = query.eq('topic.category', category)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[hall-of-fame] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to load hall of fame' }, { status: 500 })
  }

  // Filter out rows where the topic join returned null (topic not a law)
  const filtered = (data ?? []).filter((row) => {
    const t = Array.isArray(row.topic) ? row.topic[0] : row.topic
    return t && t.status === 'law'
  })

  const args: HallArgument[] = filtered.map((row) => {
    const author = Array.isArray(row.author)
      ? (row.author[0] ?? null)
      : (row.author as HallArgument['author'])
    const topic = Array.isArray(row.topic)
      ? (row.topic[0] ?? null)
      : (row.topic as HallArgument['topic'])

    // Composite score: weight quality grade and upvotes
    const gradeScore =
      row.ai_grade === 'A' ? 10 :
      row.ai_grade === 'B' ? 7 :
      row.ai_grade === 'C' ? 4 :
      row.ai_grade === 'D' ? 2 :
      row.ai_score != null ? row.ai_score : 0

    const composite = gradeScore * 3 + Math.min(row.upvotes, 100)

    return {
      id: row.id,
      topic_id: row.topic_id,
      user_id: row.user_id,
      side: row.side as 'blue' | 'red',
      content: row.content,
      upvotes: row.upvotes,
      source_url: row.source_url,
      ai_score: row.ai_score,
      ai_grade: row.ai_grade,
      created_at: row.created_at,
      composite_score: composite,
      author,
      topic,
    }
  })

  // Re-sort by composite score client-side (Supabase can't sort on computed values)
  args.sort((a, b) => b.composite_score - a.composite_score)

  return NextResponse.json({
    arguments: args,
    total: count ?? 0,
    categories,
  } satisfies HallResponse)
}
