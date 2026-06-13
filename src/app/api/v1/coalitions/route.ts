import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1Coalition {
  id: string
  name: string
  description: string | null
  member_count: number
  max_members: number
  coalition_influence: number
  wins: number
  losses: number
  win_rate: number | null
  is_public: boolean
  creator_username: string
  creator_display_name: string | null
  created_at: string
  url: string
}

export interface V1CoalitionsResponse {
  data: V1Coalition[]
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
const VALID_SORTS = ['influence', 'members', 'wins', 'new'] as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const sort = (params.get('sort') ?? 'influence') as (typeof VALID_SORTS)[number]

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
      .from('coalitions')
      .select(
        `id, name, description, member_count, max_members,
         coalition_influence, wins, losses, is_public, created_at,
         profiles!creator_id(username, display_name)`,
        { count: 'exact' },
      )
      // Only return public coalitions via the public API
      .eq('is_public', true)

    if (sort === 'influence') {
      query = query.order('coalition_influence', { ascending: false })
    } else if (sort === 'members') {
      query = query.order('member_count', { ascending: false })
    } else if (sort === 'wins') {
      query = query.order('wins', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw error

    const coalitions: V1Coalition[] = (data ?? []).map((c) => {
      const creator = c.profiles as unknown as { username: string; display_name: string | null } | null
      const total = c.wins + c.losses
      return {
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        member_count: c.member_count ?? 0,
        max_members: c.max_members ?? 100,
        coalition_influence: Math.round(c.coalition_influence ?? 0),
        wins: c.wins ?? 0,
        losses: c.losses ?? 0,
        win_rate: total > 0 ? Math.round((c.wins / total) * 100) : null,
        is_public: c.is_public ?? true,
        creator_username: creator?.username ?? '',
        creator_display_name: creator?.display_name ?? null,
        created_at: c.created_at,
        url: `${BASE_URL}/coalitions/${c.id}`,
      }
    })

    const response: V1CoalitionsResponse = {
      data: coalitions,
      meta: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/coalitions]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
