import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 21600 // 6 hours

export const CATEGORIES = [
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
] as const
export type Category = (typeof CATEGORIES)[number]

export interface SpotlightArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  source_url: string | null
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  composite: number
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

export interface SpotlightResponse {
  hero: SpotlightArgument | null
  categories: { category: Category; argument: SpotlightArgument }[]
  week_start: string
  week_end: string
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function compositeScore(ai_score: number | null, upvotes: number): number {
  // ai_score is 1–10; weight it heavily but blend with upvotes
  return (ai_score ?? 0) * 12 + upvotes
}

export async function GET() {
  const supabase = await createClient()

  const weekStart = new Date(Date.now() - WEEK_MS)
  const weekEnd = new Date()

  const { data: rows, error } = await supabase
    .from('topic_arguments')
    .select(
      `
      id, topic_id, side, content, upvotes, source_url, ai_score, ai_grade, created_at,
      author:profiles!user_id ( id, username, display_name, avatar_url, role ),
      topic:topics!topic_id ( id, statement, category, status )
    `,
    )
    .gte('created_at', weekStart.toISOString())
    .order('upvotes', { ascending: false })
    .limit(500)

  if (error || !rows) {
    return NextResponse.json({ error: error?.message ?? 'query failed' }, { status: 500 })
  }

  // Cast to typed array; Supabase returns joined rows as objects
  const typed = rows as unknown as SpotlightArgument[]

  // Attach composite score
  const scored = typed
    .map((a) => ({
      ...a,
      composite: compositeScore(a.ai_score, a.upvotes),
    }))
    .filter((a) => a.composite > 0)
    .sort((a, b) => b.composite - a.composite)

  // Hero = overall best composite this week (with at least some signal)
  const hero = scored.find((a) => a.composite >= 10) ?? scored[0] ?? null

  // Per-category champion — best composite for each category
  const seenCategories = new Set<string>()
  const categoryMap = new Map<Category, SpotlightArgument>()

  for (const arg of scored) {
    const cat = arg.topic?.category as Category | undefined
    if (!cat || !CATEGORIES.includes(cat)) continue
    if (seenCategories.has(cat)) continue
    seenCategories.add(cat)
    categoryMap.set(cat, arg)
  }

  const categories = CATEGORIES.filter((c) => categoryMap.has(c)).map((c) => ({
    category: c,
    argument: categoryMap.get(c)!,
  }))

  const body: SpotlightResponse = {
    hero,
    categories,
    week_start: weekStart.toISOString(),
    week_end: weekEnd.toISOString(),
  }

  return NextResponse.json(body)
}
