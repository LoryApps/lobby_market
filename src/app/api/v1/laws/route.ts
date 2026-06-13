import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
}

const BASE_URL = 'https://lobby.market'

const VALID_CATEGORIES = [
  'Politics', 'Technology', 'Ethics', 'Culture', 'Economics',
  'Science', 'Philosophy', 'Health', 'Environment', 'Education', 'Other',
]
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

export interface V1Law {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  for_pct: number
  against_pct: number
  total_votes: number
  established_at: string
  url: string
  og_image_url: string
}

export interface V1LawsResponse {
  data: V1Law[]
  meta: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const category = params.get('category') ?? null

  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      {
        error: `Invalid category. Valid values: ${VALID_CATEGORIES.join(', ')}`,
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  try {
    const supabase = await createClient()

    let query = supabase
      .from('topics')
      .select(
        'id, statement, description, category, scope, blue_pct, total_votes, updated_at, created_at',
        { count: 'exact' },
      )
      .eq('status', 'law')

    if (category) query = query.eq('category', category)

    query = query.order('updated_at', { ascending: false })
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) throw error

    const laws: V1Law[] = (data ?? []).map((t) => {
      const forPct = Math.max(0, Math.min(100, Math.round(t.blue_pct ?? 50)))
      return {
        id: t.id,
        statement: t.statement,
        description: t.description ?? null,
        category: t.category ?? null,
        scope: t.scope ?? 'Global',
        for_pct: forPct,
        against_pct: 100 - forPct,
        total_votes: t.total_votes ?? 0,
        established_at: t.updated_at ?? t.created_at,
        url: `${BASE_URL}/law/${t.id}`,
        og_image_url: `${BASE_URL}/api/og/law/${t.id}`,
      }
    })

    const response: V1LawsResponse = {
      data: laws,
      meta: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/laws]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
