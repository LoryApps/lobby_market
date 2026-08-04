import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/rising
 *
 * Topics gaining momentum right now — sorted by vote velocity
 * (votes per hour since creation). Restricted to the last 7 days so
 * the feed stays fresh; older topics graduate to /trending.
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "top" (velocity) | "new" | "hot" (default "top")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  // "top" is treated as velocity (the rising mode default)
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  // Fetch active/voting topics from the last 7 days.
  // We pull more than `limit` so we can re-rank by velocity client-side.
  const fetchSize = Math.min(limit + offset + 100, 500)

  const { data, error } = await supabase
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
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(fetchSize)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topics = data ?? []

  // Compute velocity = total_votes / hours_since_creation (min 1h denominator)
  const now = Date.now()
  const withVelocity = topics.map((t) => {
    const ageMs = now - new Date(t.created_at).getTime()
    const ageHours = Math.max(ageMs / 3_600_000, 1)
    const velocity = (t.total_votes ?? 0) / ageHours
    return { ...t, _velocity: velocity }
  })

  let sorted: typeof withVelocity
  if (sort === 'new') {
    // Already sorted by created_at desc from the query
    sorted = withVelocity
  } else if (sort === 'hot') {
    sorted = [...withVelocity].sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
  } else {
    // "top" / default → velocity (votes-per-hour) — the defining sort for Rising
    sorted = [...withVelocity].sort((a, b) => b._velocity - a._velocity)
  }

  const page = sorted.slice(offset, offset + limit)

  return NextResponse.json({ topics: page })
}
