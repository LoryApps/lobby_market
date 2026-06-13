import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1Topic {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: 'proposed' | 'active' | 'voting' | 'law' | 'failed'
  for_pct: number
  against_pct: number
  total_votes: number
  view_count: number
  created_at: string
  voting_ends_at: string | null
  url: string
}

export interface V1TopicsResponse {
  data: V1Topic[]
  meta: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
}

const BASE_URL = 'https://lobby.market'

const VALID_STATUSES = ['proposed', 'active', 'voting', 'law', 'failed']
const VALID_CATEGORIES = [
  'Politics', 'Technology', 'Ethics', 'Culture', 'Economics',
  'Science', 'Philosophy', 'Health', 'Environment', 'Education', 'Other',
]
const VALID_SORTS = ['votes', 'new', 'trending', 'score'] as const
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  // ── Parse query params ──────────────────────────────────────────────────────
  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const status = params.get('status') ?? null
  const category = params.get('category') ?? null
  const sort = (params.get('sort') ?? 'votes') as (typeof VALID_SORTS)[number]

  // ── Validate ────────────────────────────────────────────────────────────────
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      {
        error: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}`,
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      {
        error: `Invalid category. Valid values: ${VALID_CATEGORIES.join(', ')}`,
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  if (!VALID_SORTS.includes(sort)) {
    return NextResponse.json(
      {
        error: `Invalid sort. Valid values: ${VALID_SORTS.join(', ')}`,
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  try {
    const supabase = await createClient()

    // ── Build query ─────────────────────────────────────────────────────────
    let query = supabase
      .from('topics')
      .select(
        'id, statement, description, category, scope, status, blue_pct, total_votes, view_count, created_at, voting_ends_at',
        { count: 'exact' },
      )

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)

    // Sort
    if (sort === 'votes') {
      query = query.order('total_votes', { ascending: false })
    } else if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'trending') {
      query = query.order('feed_score', { ascending: false })
    } else {
      query = query.order('feed_score', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) throw error

    const topics: V1Topic[] = (data ?? []).map((t) => {
      const forPct = Math.max(0, Math.min(100, Math.round(t.blue_pct ?? 50)))
      return {
        id: t.id,
        statement: t.statement,
        description: t.description ?? null,
        category: t.category ?? null,
        scope: t.scope ?? 'Global',
        status: t.status as V1Topic['status'],
        for_pct: forPct,
        against_pct: 100 - forPct,
        total_votes: t.total_votes ?? 0,
        view_count: t.view_count ?? 0,
        created_at: t.created_at,
        voting_ends_at: t.voting_ends_at ?? null,
        url: `${BASE_URL}/topic/${t.id}`,
      }
    })

    const response: V1TopicsResponse = {
      data: topics,
      meta: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/topics]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
