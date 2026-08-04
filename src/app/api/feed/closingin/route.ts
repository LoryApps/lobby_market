import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/closingin
 *
 * Topics in the Voting phase sorted by blue_pct descending — surfacing
 * the ones closest to crossing the law threshold. Secondarily includes
 * high-support active topics approaching the voting activation threshold.
 *
 * These are the highest-stakes topics: votes here are most consequential.
 *
 * Query params:
 *   offset – pagination offset (default 0)
 *   limit  – page size (default 20, max 50)
 *   sort   – "top" (blue_pct desc) | "new" | "hot" (vote count desc)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  // For 'top' sort: voting topics first (ordered by blue_pct), then active with high support
  // For other sorts: combine both pools and re-sort
  if (sort === 'top') {
    const { data: votingData, error: votingErr } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .eq('status', 'voting')
      .order('blue_pct', { ascending: false })
      .range(offset, offset + limit - 1)

    if (votingErr) {
      return NextResponse.json({ error: votingErr.message }, { status: 500 })
    }

    const voting = votingData ?? []

    // If there are enough voting topics to fill the page, return early
    if (voting.length >= limit) {
      return NextResponse.json({ topics: voting })
    }

    // Pad with high-support active topics
    const remaining = limit - voting.length
    const { data: activeData } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .eq('status', 'active')
      .gte('blue_pct', 55)
      .order('blue_pct', { ascending: false })
      .limit(remaining)

    const topics = [...voting, ...(activeData ?? [])]
    return NextResponse.json({ topics })
  }

  // Non-'top' sorts: fetch both pools and re-sort
  const [votingRes, activeRes] = await Promise.all([
    supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .eq('status', 'voting')
      .limit(200),
    supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .eq('status', 'active')
      .gte('blue_pct', 55)
      .limit(100),
  ])

  const combined = [...(votingRes.data ?? []), ...(activeRes.data ?? [])]

  if (sort === 'new') {
    combined.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  } else {
    // 'hot' — sort by vote count
    combined.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
  }

  const page = combined.slice(offset, offset + limit)
  return NextResponse.json({ topics: page })
}
