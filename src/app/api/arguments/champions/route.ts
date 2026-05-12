import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type SideFilter = 'all' | 'for' | 'against'
export type SortBy = 'win_pct' | 'wins' | 'bouts'
export type MinBouts = 3 | 5 | 10 | 20

export interface ChampionArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  ai_score: number | null
  source_url: string | null
  created_at: string
  wins: number
  bouts: number
  win_pct: number
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  }
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
}

export interface ChampionsResponse {
  arguments: ChampionArgument[]
  total: number
  min_bouts: MinBouts
  side: SideFilter
  sort: SortBy
  category: string | null
}

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Environment',
  'Health',
  'Education',
  'Justice',
]

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const side = (searchParams.get('side') ?? 'all') as SideFilter
  const sortBy = (searchParams.get('sort') ?? 'win_pct') as SortBy
  const minBouts = parseInt(searchParams.get('min_bouts') ?? '5', 10) as MinBouts
  const category = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const categoryFilter =
    category && CATEGORIES.includes(category) ? category : null

  // 1. Query the arena_stats view — get top argument IDs by arena performance
  const statsQuery = supabase
    .from('argument_arena_stats')
    .select('argument_id, wins, bouts, win_pct')
    .gte('bouts', minBouts)
    .not('win_pct', 'is', null)
    .order(sortBy === 'win_pct' ? 'win_pct' : sortBy === 'wins' ? 'wins' : 'bouts', {
      ascending: false,
    })
    .order('wins', { ascending: false })

  const { data: allStats, error: statsErr } = await statsQuery
  if (statsErr) {
    return NextResponse.json({ error: statsErr.message }, { status: 500 })
  }

  if (!allStats || allStats.length === 0) {
    return NextResponse.json({
      arguments: [],
      total: 0,
      min_bouts: minBouts,
      side,
      sort: sortBy,
      category: categoryFilter,
    } satisfies ChampionsResponse)
  }

  // 2. Fetch argument details for all qualifying IDs (up to 200 for filtering)
  const allIds = allStats.map((s) => s.argument_id as string)
  const idsForQuery = allIds.slice(0, 200)

  let argQuery = supabase
    .from('topic_arguments')
    .select(
      `id, content, side, upvotes, ai_grade, ai_score, source_url, created_at,
       topic:topics!topic_id ( id, statement, category, status ),
       author:profiles!user_id ( username, display_name, avatar_url, role, clout )`,
    )
    .in('id', idsForQuery)

  if (side === 'for') argQuery = argQuery.eq('side', 'blue')
  else if (side === 'against') argQuery = argQuery.eq('side', 'red')

  const { data: argRows, error: argErr } = await argQuery
  if (argErr) {
    return NextResponse.json({ error: argErr.message }, { status: 500 })
  }

  // 3. Build lookup maps and merge
  const statsMap = new Map(allStats.map((s) => [s.argument_id as string, s]))

  function coerce<T>(v: T | T[]): T | null {
    return Array.isArray(v) ? (v[0] ?? null) : v ?? null
  }

  const merged = (argRows ?? [])
    .map((row) => {
      const r = row as unknown as {
        id: string
        content: string
        side: string
        upvotes: number
        ai_grade: string | null
        ai_score: number | null
        source_url: string | null
        created_at: string
        topic: {
          id: string
          statement: string
          category: string | null
          status: string
        } | null
        author: {
          username: string
          display_name: string | null
          avatar_url: string | null
          role: string
          clout: number
        } | null
      }

      const stats = statsMap.get(r.id)
      if (!stats) return null

      const topic = coerce(r.topic)
      const author = coerce(r.author)
      if (!topic || !author) return null

      if (categoryFilter && topic.category !== categoryFilter) return null

      return {
        id: r.id,
        content: r.content,
        side: r.side as 'blue' | 'red',
        upvotes: r.upvotes,
        ai_grade: r.ai_grade,
        ai_score: r.ai_score,
        source_url: r.source_url,
        created_at: r.created_at,
        wins: stats.wins as number,
        bouts: stats.bouts as number,
        win_pct: stats.win_pct as number,
        topic,
        author,
      } satisfies ChampionArgument
    })
    .filter(Boolean) as ChampionArgument[]

  merged.sort((a, b) => {
    if (sortBy === 'win_pct') return b.win_pct - a.win_pct || b.wins - a.wins
    if (sortBy === 'wins') return b.wins - a.wins || b.win_pct - a.win_pct
    return b.bouts - a.bouts || b.win_pct - a.win_pct
  })

  const total = merged.length
  const paginated = merged.slice(offset, offset + limit)

  return NextResponse.json({
    arguments: paginated,
    total,
    min_bouts: minBouts,
    side,
    sort: sortBy,
    category: categoryFilter,
  } satisfies ChampionsResponse)
}
