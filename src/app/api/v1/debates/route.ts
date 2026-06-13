import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1Debate {
  id: string
  topic_id: string
  topic_statement: string
  title: string
  description: string | null
  type: 'quick' | 'grand' | 'tribunal'
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  viewer_count: number
  blue_sway: number
  red_sway: number
  host_username: string
  host_display_name: string | null
  created_at: string
  url: string
}

export interface V1DebatesResponse {
  data: V1Debate[]
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
const VALID_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'] as const
const VALID_TYPES = ['quick', 'grand', 'tribunal'] as const
const VALID_SORTS = ['newest', 'scheduled', 'viewers'] as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const status = params.get('status') as (typeof VALID_STATUSES)[number] | null
  const type = params.get('type') as (typeof VALID_TYPES)[number] | null
  const sort = (params.get('sort') ?? 'newest') as (typeof VALID_SORTS)[number]

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      {
        error: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}`,
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  if (type && !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      {
        error: `Invalid type. Valid values: ${VALID_TYPES.join(', ')}`,
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

    let query = supabase
      .from('debates')
      .select(
        `id, topic_id, type, status, title, description,
         scheduled_at, started_at, ended_at,
         viewer_count, blue_sway, red_sway, created_at,
         topics!inner(statement),
         profiles!creator_id(username, display_name)`,
        { count: 'exact' },
      )

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)

    if (sort === 'scheduled') {
      query = query.order('scheduled_at', { ascending: true })
    } else if (sort === 'viewers') {
      query = query.order('viewer_count', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw error

    const debates: V1Debate[] = (data ?? []).map((d) => {
      const topic = d.topics as unknown as { statement: string }
      const host = d.profiles as unknown as { username: string; display_name: string | null } | null
      return {
        id: d.id,
        topic_id: d.topic_id,
        topic_statement: topic?.statement ?? '',
        title: d.title,
        description: d.description ?? null,
        type: d.type as V1Debate['type'],
        status: d.status as V1Debate['status'],
        scheduled_at: d.scheduled_at,
        started_at: d.started_at ?? null,
        ended_at: d.ended_at ?? null,
        viewer_count: d.viewer_count ?? 0,
        blue_sway: d.blue_sway ?? 50,
        red_sway: d.red_sway ?? 50,
        host_username: host?.username ?? '',
        host_display_name: host?.display_name ?? null,
        created_at: d.created_at,
        url: `${BASE_URL}/debate/${d.id}`,
      }
    })

    const response: V1DebatesResponse = {
      data: debates,
      meta: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/debates]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
