import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/elders
 *
 * Returns unresolved topics that have been open for 30+ days, sorted by age
 * (oldest first by default). These are debates the community has yet to settle.
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – 'age' | 'votes' | 'contested' (default 'age')
 *   category – filter by category (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'age'
  const category = searchParams.get('category')

  const supabase = await createClient()

  const MIN_DAYS = 30
  const cutoff = new Date(Date.now() - MIN_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        role,
        clout
      )
    `)
    .in('status', ['proposed', 'active', 'voting'])
    .lte('created_at', cutoff)

  if (category) {
    query = query.eq('category', category)
  }

  if (sort === 'votes') {
    query = query.order('total_votes', { ascending: false })
  } else if (sort === 'contested') {
    // Closest to 50/50 — most unsettled
    query = query.order('total_votes', { ascending: false })
  } else {
    // age — oldest first
    query = query.order('created_at', { ascending: true })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  let topics = data ?? []

  if (sort === 'contested') {
    topics = [...topics].sort((a, b) => {
      const distA = Math.abs((a.blue_pct ?? 50) - 50)
      const distB = Math.abs((b.blue_pct ?? 50) - 50)
      return distA - distB // smaller distance = more contested = first
    })
  }

  return NextResponse.json({
    topics,
    hasMore: topics.length === limit,
  })
}
