import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1User {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
  total_arguments: number
  civic_archetype: string | null
  member_since: string
  url: string
}

export interface V1UsersResponse {
  data: V1User[]
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
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
}

const BASE_URL = 'https://lobby.market'
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20
const VALID_SORTS = ['clout', 'votes', 'arguments', 'new'] as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const sort = (params.get('sort') ?? 'clout') as (typeof VALID_SORTS)[number]

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
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, clout, total_votes, total_arguments, civic_archetype, created_at',
        { count: 'exact' },
      )
      // Never expose admin/private accounts
      .neq('role', 'admin')

    if (sort === 'clout') {
      query = query.order('clout', { ascending: false })
    } else if (sort === 'votes') {
      query = query.order('total_votes', { ascending: false })
    } else if (sort === 'arguments') {
      query = query.order('total_arguments', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw error

    const users: V1User[] = (data ?? []).map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name ?? null,
      avatar_url: u.avatar_url ?? null,
      role: u.role ?? 'person',
      clout: u.clout ?? 0,
      total_votes: u.total_votes ?? 0,
      total_arguments: u.total_arguments ?? 0,
      civic_archetype: u.civic_archetype ?? null,
      member_since: u.created_at,
      url: `${BASE_URL}/profile/${u.username}`,
    }))

    const response: V1UsersResponse = {
      data: users,
      meta: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/users]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
