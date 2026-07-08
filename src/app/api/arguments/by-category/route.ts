import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CategoryArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  topic: {
    id: string
    statement: string
    status: string
  } | null
}

export interface CategoryData {
  name: string
  total_arguments: number
  for_count: number
  against_count: number
  law_count: number
  top_for: CategoryArgument | null
  top_against: CategoryArgument | null
}

export interface ByCategoryResponse {
  categories: CategoryData[]
  period: string
}

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

const VALID_PERIODS = ['week', 'month', 'all'] as const
type Period = (typeof VALID_PERIODS)[number]

function periodCutoff(period: Period): string | null {
  if (period === 'week') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (period === 'month') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString()
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const periodParam = searchParams.get('period') ?? 'all'
  const period: Period = (VALID_PERIODS as readonly string[]).includes(periodParam)
    ? (periodParam as Period)
    : 'all'

  const supabase = await createClient()
  const since = periodCutoff(period)

  // Step 1: fetch all topics keyed by category so we can filter arguments
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, status, category')
    .in('category', CATEGORIES)

  const topics = (topicRows ?? []) as {
    id: string
    statement: string
    status: string
    category: string
  }[]

  // Build a map: topic_id → { statement, status, category }
  const topicMap = new Map(
    topics.map((t) => [t.id, { id: t.id, statement: t.statement, status: t.status, category: t.category }])
  )

  // Count laws per category
  const lawCounts: Record<string, number> = {}
  for (const cat of CATEGORIES) {
    lawCounts[cat] = topics.filter((t) => t.category === cat && t.status === 'law').length
  }

  const topicIds = topics.map((t) => t.id)

  if (topicIds.length === 0) {
    const empty: CategoryData[] = CATEGORIES.map((name) => ({
      name,
      total_arguments: 0,
      for_count: 0,
      against_count: 0,
      law_count: 0,
      top_for: null,
      top_against: null,
    }))
    return NextResponse.json({ categories: empty, period } satisfies ByCategoryResponse)
  }

  // Step 2: fetch arguments for all those topics
  let argQuery = supabase
    .from('topic_arguments')
    .select(
      `id, topic_id, side, content, upvotes, created_at,
       author:profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url)`
    )
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })
    .limit(5000)

  if (since) {
    argQuery = argQuery.gte('created_at', since)
  }

  const { data: argRows } = await argQuery

  const allArgs = (argRows ?? []) as Array<{
    id: string
    topic_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    author: { username: string; display_name: string | null; avatar_url: string | null } | null
  }>

  // Step 3: group and aggregate per category
  const categories: CategoryData[] = CATEGORIES.map((cat) => {
    const catTopicIds = new Set(
      topics.filter((t) => t.category === cat).map((t) => t.id)
    )

    const catArgs = allArgs
      .filter((a) => catTopicIds.has(a.topic_id))
      .map((a) => ({
        ...a,
        topic: topicMap.get(a.topic_id) ?? null,
      })) as CategoryArgument[]

    const forArgs = catArgs.filter((a) => a.side === 'blue')
    const againstArgs = catArgs.filter((a) => a.side === 'red')

    return {
      name: cat,
      total_arguments: catArgs.length,
      for_count: forArgs.length,
      against_count: againstArgs.length,
      law_count: lawCounts[cat] ?? 0,
      top_for: forArgs[0] ?? null,
      top_against: againstArgs[0] ?? null,
    }
  })

  // Sort by total_arguments descending so the richest categories come first
  categories.sort((a, b) => b.total_arguments - a.total_arguments)

  return NextResponse.json({ categories, period } satisfies ByCategoryResponse)
}
