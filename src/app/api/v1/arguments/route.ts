import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1Argument {
  id: string
  topic_id: string
  topic_statement: string
  side: 'for' | 'against'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  author_username: string
  author_display_name: string | null
  created_at: string
  url: string
}

export interface V1ArgumentsResponse {
  data: V1Argument[]
  meta: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
}

const BASE_URL = 'https://lobby.market'
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20
const VALID_SORTS = ['upvotes', 'score', 'new'] as const
const VALID_SIDES = ['for', 'against'] as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const sort = (params.get('sort') ?? 'upvotes') as (typeof VALID_SORTS)[number]
  const topicId = params.get('topic_id') ?? null
  const side = params.get('side') as (typeof VALID_SIDES)[number] | null

  if (!VALID_SORTS.includes(sort)) {
    return NextResponse.json(
      {
        error: `Invalid sort. Valid values: ${VALID_SORTS.join(', ')}`,
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  if (side && !VALID_SIDES.includes(side)) {
    return NextResponse.json(
      {
        error: `Invalid side. Valid values: ${VALID_SIDES.join(', ')}`,
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  try {
    const supabase = await createClient()

    // topic_arguments uses side: 'blue' (for) | 'red' (against)
    const dbSide = side === 'for' ? 'blue' : side === 'against' ? 'red' : null

    let query = supabase
      .from('topic_arguments')
      .select(
        `id, topic_id, side, content, upvotes, ai_score, ai_grade, created_at,
         topics!inner(statement),
         profiles!user_id(username, display_name)`,
        { count: 'exact' },
      )

    if (topicId) query = query.eq('topic_id', topicId)
    if (dbSide) query = query.eq('side', dbSide)

    if (sort === 'upvotes') {
      query = query.order('upvotes', { ascending: false })
    } else if (sort === 'score') {
      query = query.order('ai_score', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw error

    const args: V1Argument[] = (data ?? []).map((a) => {
      const topic = a.topics as unknown as { statement: string }
      const author = a.profiles as unknown as { username: string; display_name: string | null } | null
      return {
        id: a.id,
        topic_id: a.topic_id,
        topic_statement: topic?.statement ?? '',
        // Map blue→for, red→against
        side: a.side === 'blue' ? 'for' : 'against',
        content: a.content,
        upvotes: a.upvotes ?? 0,
        ai_score: a.ai_score ?? null,
        ai_grade: a.ai_grade ?? null,
        author_username: author?.username ?? '',
        author_display_name: author?.display_name ?? null,
        created_at: a.created_at,
        url: `${BASE_URL}/arguments/${a.id}`,
      }
    })

    const response: V1ArgumentsResponse = {
      data: args,
      meta: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/arguments]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
