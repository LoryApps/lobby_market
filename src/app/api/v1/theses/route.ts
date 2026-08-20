import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1Thesis {
  id: string
  statement: string
  rationale: string | null
  category: string
  status: 'active' | 'vindicated' | 'refuted' | 'expired'
  agree_count: number
  disagree_count: number
  resolution_date: string | null
  resolved_at: string | null
  created_at: string
  author: {
    username: string
    display_name: string | null
  } | null
  related_topic_id: string | null
  url: string
}

export interface V1ThesesResponse {
  data: V1Thesis[]
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
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
}

const BASE_URL = 'https://lobby.market'

const VALID_STATUSES = ['active', 'vindicated', 'refuted', 'expired']
const VALID_CATEGORIES = [
  'economics', 'politics', 'technology', 'science',
  'ethics', 'philosophy', 'culture', 'health', 'environment', 'education',
]
const VALID_SORTS = ['new', 'votes', 'resolving'] as const
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const limitRaw = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT)

  const offsetRaw = parseInt(params.get('offset') ?? '0', 10)
  const offset = isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw)

  const rawStatus = params.get('status')
  const status = rawStatus && VALID_STATUSES.includes(rawStatus) ? rawStatus : null

  const rawCategory = params.get('category')
  const category = rawCategory && VALID_CATEGORIES.includes(rawCategory.toLowerCase())
    ? rawCategory.toLowerCase()
    : null

  const rawSort = params.get('sort')
  const sort: typeof VALID_SORTS[number] = VALID_SORTS.includes(rawSort as typeof VALID_SORTS[number])
    ? (rawSort as typeof VALID_SORTS[number])
    : 'new'

  try {
    const supabase = await createClient()

    let query = supabase
      .from('civic_theses')
      .select(`
        id,
        statement,
        rationale,
        category,
        status,
        agree_count,
        disagree_count,
        resolution_date,
        resolved_at,
        created_at,
        related_topic_id,
        profiles!civic_theses_user_id_fkey(username, display_name)
      `, { count: 'exact' })
      .eq('is_public', true)
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)

    if (sort === 'votes') {
      query = query
        .order('agree_count', { ascending: false })
        .order('disagree_count', { ascending: false })
        .order('created_at', { ascending: false })
    } else if (sort === 'resolving') {
      // Theses with resolution dates coming up soonest
      query = query
        .not('resolution_date', 'is', null)
        .order('resolution_date', { ascending: true })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch theses', detail: error.message },
        { status: 500, headers: CORS },
      )
    }

    const total = count ?? 0

    const theses: V1Thesis[] = (data ?? []).map((row) => {
      const profileRaw = row.profiles
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
      return {
        id: row.id,
        statement: row.statement,
        rationale: row.rationale ?? null,
        category: row.category,
        status: row.status as V1Thesis['status'],
        agree_count: row.agree_count ?? 0,
        disagree_count: row.disagree_count ?? 0,
        resolution_date: row.resolution_date ?? null,
        resolved_at: row.resolved_at ?? null,
        created_at: row.created_at,
        related_topic_id: row.related_topic_id ?? null,
        author: profile
          ? {
              username: (profile as { username: string }).username,
              display_name: (profile as { display_name: string | null }).display_name ?? null,
            }
          : null,
        url: `${BASE_URL}/thesis/${row.id}`,
      }
    })

    const response: V1ThesesResponse = {
      data: theses,
      meta: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[v1/theses] unexpected error', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
