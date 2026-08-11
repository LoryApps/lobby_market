import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartographyPoint {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
}

export interface CartographyResponse {
  points: CartographyPoint[]
  categories: string[]
  platform: {
    total_topics: number
    total_laws: number
    median_votes: number
    most_contested_id: string | null
    most_engaged_id: string | null
  }
}

// ─── GET /api/cartography ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const url = req.nextUrl
  const category = url.searchParams.get('category') ?? 'all'
  const status = url.searchParams.get('status') ?? 'all'     // all | active | law
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '500', 10), 1000)

  let query = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(limit)

  if (category !== 'all') {
    query = query.eq('category', category)
  }

  if (status === 'active') {
    query = query.eq('status', 'active')
  } else if (status === 'law') {
    query = query.eq('status', 'law')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const points = (data ?? []) as CartographyPoint[]

  const categories = Array.from(
    new Set(points.map(p => p.category).filter(Boolean) as string[])
  ).sort()

  const votes = points.map(p => p.total_votes).sort((a, b) => a - b)
  const median_votes = votes.length > 0
    ? votes[Math.floor(votes.length / 2)]
    : 0

  const most_contested = points
    .filter(p => p.total_votes >= 50)
    .sort((a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50))[0]

  const most_engaged = points[0]

  return NextResponse.json({
    points,
    categories,
    platform: {
      total_topics: points.filter(p => p.status !== 'law').length,
      total_laws: points.filter(p => p.status === 'law').length,
      median_votes,
      most_contested_id: most_contested?.id ?? null,
      most_engaged_id: most_engaged?.id ?? null,
    },
  } satisfies CartographyResponse)
}
