import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/laws/recent
 *
 * Recently established laws with platform-wide stats.
 *
 * Query params:
 *   offset   – pagination offset (default 0)
 *   limit    – page size (default 20, max 50)
 *   sort     – "new" (established_at desc) | "votes" | "consensus"
 *   category – filter by category slug
 */

export interface RecentLaw {
  id: string
  topic_id: string
  statement: string
  description: string | null
  category: string | null
  scope: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
}

export interface RecentLawsStats {
  total: number
  today: number
  this_week: number
  this_month: number
}

export interface RecentLawsResponse {
  laws: RecentLaw[]
  stats: RecentLawsStats
  hasMore: boolean
  total: number
}

type LawRow = {
  id: string
  topic_id: string
  established_at: string
  topics: {
    statement: string
    description: string | null
    category: string | null
    scope: string | null
    blue_pct: number
    total_votes: number
    author: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
    } | null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'new'
  const category = searchParams.get('category') ?? null

  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const weekStart = new Date(now)
  weekStart.setUTCDate(weekStart.getUTCDate() - 7)
  const monthStart = new Date(now)
  monthStart.setUTCDate(monthStart.getUTCDate() - 30)

  // Stats query (lightweight)
  const statsRes = await supabase
    .from('laws')
    .select('established_at', { count: 'exact', head: false })
    .eq('is_active', true)

  const allLaws = statsRes.data ?? []
  const totalLaws = statsRes.count ?? allLaws.length
  const stats: RecentLawsStats = {
    total: totalLaws,
    today: allLaws.filter(
      (l) => l.established_at && new Date(l.established_at) >= todayStart
    ).length,
    this_week: allLaws.filter(
      (l) => l.established_at && new Date(l.established_at) >= weekStart
    ).length,
    this_month: allLaws.filter(
      (l) => l.established_at && new Date(l.established_at) >= monthStart
    ).length,
  }

  // Main list query — fetch up to 200 to allow client-side sort + pagination
  const listRes = await supabase
    .from('laws')
    .select(`
      id,
      topic_id,
      established_at,
      topics!inner(
        statement,
        description,
        category,
        scope,
        blue_pct,
        total_votes,
        author:profiles!topics_author_id_fkey(
          username,
          display_name,
          avatar_url,
          role,
          clout
        )
      )
    `)
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(200)

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message }, { status: 500 })
  }

  let laws: RecentLaw[] = (listRes.data as unknown as LawRow[]).map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    statement: row.topics?.statement ?? '',
    description: row.topics?.description ?? null,
    category: row.topics?.category ?? null,
    scope: row.topics?.scope ?? null,
    blue_pct: row.topics?.blue_pct ?? 50,
    total_votes: row.topics?.total_votes ?? 0,
    established_at: row.established_at,
    author: row.topics?.author ?? null,
  }))

  // Apply category filter
  if (category) {
    laws = laws.filter((l) => l.category === category)
  }

  // Apply sort
  if (sort === 'votes') {
    laws.sort((a, b) => b.total_votes - a.total_votes)
  } else if (sort === 'consensus') {
    laws.sort((a, b) => b.blue_pct - a.blue_pct)
  }
  // 'new' is already sorted by established_at desc from the query

  const paginated = laws.slice(offset, offset + limit)

  return NextResponse.json({
    laws: paginated,
    stats,
    hasMore: offset + limit < laws.length,
    total: laws.length,
  } satisfies RecentLawsResponse)
}
