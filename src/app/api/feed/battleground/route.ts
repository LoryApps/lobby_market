import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'hot'

  const supabase = await createClient()

  // Contest score: abs(blue_pct - 50) — lower means more contested.
  // We fetch topics with blue_pct in [35, 65] so "battleground" topics are
  // meaningfully split without including landslides.
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
    .in('status', ['active', 'voting'])
    .gte('blue_pct', 35)
    .lte('blue_pct', 65)
    .range(offset, offset + limit - 1)

  if (sort === 'hot') {
    query = query.order('vote_count', { ascending: false })
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    // "top" — order by contest score (closest to 50/50) then by engagement
    // Supabase doesn't support computed ORDER BY, so we use vote_count as a
    // secondary sort and let the client re-rank if needed.
    query = query
      .order('vote_count', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topics = data ?? []

  // For "top" sort re-rank client-side isn't feasible server-side either without
  // a generated column, so we sort in JS by contest closeness then vote_count.
  const sorted =
    sort === 'top'
      ? [...topics].sort((a, b) => {
          const scoreA = Math.abs((a.blue_pct ?? 50) - 50)
          const scoreB = Math.abs((b.blue_pct ?? 50) - 50)
          if (scoreA !== scoreB) return scoreA - scoreB
          return (b.vote_count ?? 0) - (a.vote_count ?? 0)
        })
      : topics

  return NextResponse.json({ topics: sorted })
}
