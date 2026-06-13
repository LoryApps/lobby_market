import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1LeaderboardEntry {
  rank: number
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
  total_arguments: number
  reputation_score: number
  civic_archetype: string | null
  url: string
}

export interface V1LeaderboardResponse {
  data: V1LeaderboardEntry[]
  meta: {
    metric: string
    total: number
    limit: number
    offset: number
    has_more: boolean
    updated_at: string
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
}

const BASE_URL = 'https://lobby.market'
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100
const VALID_METRICS = ['clout', 'votes', 'arguments', 'reputation'] as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const metric = (params.get('metric') ?? 'clout') as (typeof VALID_METRICS)[number]

  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json(
      {
        error: `Invalid metric. Valid values: ${VALID_METRICS.join(', ')}`,
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
        'id, username, display_name, avatar_url, role, clout, total_votes, total_arguments, reputation_score, civic_archetype',
        { count: 'exact' },
      )
      .neq('role', 'admin')

    if (metric === 'clout') {
      query = query.order('clout', { ascending: false })
    } else if (metric === 'votes') {
      query = query.order('total_votes', { ascending: false })
    } else if (metric === 'arguments') {
      query = query.order('total_arguments', { ascending: false })
    } else {
      query = query.order('reputation_score', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query
    if (error) throw error

    const entries: V1LeaderboardEntry[] = (data ?? []).map((u, i) => ({
      rank: offset + i + 1,
      id: u.id,
      username: u.username,
      display_name: u.display_name ?? null,
      avatar_url: u.avatar_url ?? null,
      role: u.role ?? 'person',
      clout: u.clout ?? 0,
      total_votes: u.total_votes ?? 0,
      total_arguments: u.total_arguments ?? 0,
      reputation_score: u.reputation_score ?? 0,
      civic_archetype: u.civic_archetype ?? null,
      url: `${BASE_URL}/profile/${u.username}`,
    }))

    const response: V1LeaderboardResponse = {
      data: entries,
      meta: {
        metric,
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
        updated_at: new Date().toISOString(),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/leaderboard]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
