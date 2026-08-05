import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/mandate
 *
 * Topics where the community has reached an overwhelming consensus —
 * blue_pct >= 80 (strong FOR mandate) or blue_pct <= 20 (strong AGAINST mandate).
 * Sorted by degree of consensus (most extreme first), then by vote count.
 *
 * Distinct from:
 *   /api/feed/battleground  — contested 35–65% split topics
 *   /api/feed/closingin     — topics near the law threshold
 *   /api/feed/newlaws       — topics that already became law
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   side    – 'for' | 'against' | 'all' (default 'all')
 *   sort    – 'consensus' | 'votes' | 'new' (default 'consensus')
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const side = searchParams.get('side') ?? 'all'
  const sort = searchParams.get('sort') ?? 'consensus'

  const supabase = await createClient()

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
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', 5)

  // Side filter
  if (side === 'for') {
    query = query.gte('blue_pct', 80)
  } else if (side === 'against') {
    query = query.lte('blue_pct', 20)
  } else {
    // all: either strong FOR or strong AGAINST
    // Supabase doesn't support OR across range conditions in a single call,
    // so we fetch both sides and merge in JS
  }

  if (sort === 'votes') {
    query = query.order('total_votes', { ascending: false })
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    // consensus: most extreme split first
    query = query.order('total_votes', { ascending: false })
  }

  query = query.range(offset, offset + limit * 2 - 1)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []

  // Filter for mandate threshold client-side (handles the OR condition)
  let filtered = side === 'all'
    ? rows.filter((t) => (t.blue_pct ?? 50) >= 80 || (t.blue_pct ?? 50) <= 20)
    : rows

  // For 'for' side, already filtered above via DB query — double-check
  if (side === 'for') filtered = filtered.filter((t) => (t.blue_pct ?? 50) >= 80)
  if (side === 'against') filtered = filtered.filter((t) => (t.blue_pct ?? 50) <= 20)

  // Sort by degree of consensus (distance from 50 — higher = more decisive)
  if (sort === 'consensus') {
    filtered = [...filtered].sort((a, b) => {
      const scoreA = Math.abs((a.blue_pct ?? 50) - 50)
      const scoreB = Math.abs((b.blue_pct ?? 50) - 50)
      if (Math.abs(scoreA - scoreB) > 0.5) return scoreB - scoreA
      return (b.total_votes ?? 0) - (a.total_votes ?? 0)
    })
  }

  const page = filtered.slice(0, limit)

  return NextResponse.json({
    topics: page,
    hasMore: filtered.length > limit,
  })
}
