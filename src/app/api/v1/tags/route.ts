import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1Tag {
  tag: string
  topic_count: number
  law_count: number
  active_count: number
  total_votes: number
  url: string
}

export interface V1TagsResponse {
  data: V1Tag[]
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
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
}

const BASE_URL = 'https://lobby.market'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const VALID_SORTS = ['topics', 'votes', 'laws', 'active'] as const

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const rawLimit = parseInt(params.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const sort = (params.get('sort') ?? 'topics') as (typeof VALID_SORTS)[number]

  if (!VALID_SORTS.includes(sort)) {
    return NextResponse.json(
      { error: `Invalid sort. Valid values: ${VALID_SORTS.join(', ')}` },
      { status: 400, headers: CORS },
    )
  }

  try {
    const supabase = await createClient()

    // Fetch all topics with tags to aggregate counts
    const { data, error } = await supabase
      .from('topics')
      .select('tags, status, total_votes')
      .not('tags', 'eq', '{}')
      .in('status', ['proposed', 'active', 'voting', 'law'])
      .limit(5000)

    if (error) throw error

    // Build tag statistics map
    const tagMap = new Map<
      string,
      { topic_count: number; law_count: number; active_count: number; total_votes: number }
    >()

    for (const row of data ?? []) {
      const tags: string[] = row.tags ?? []
      for (const tag of tags) {
        if (!tag) continue
        const existing = tagMap.get(tag) ?? {
          topic_count: 0,
          law_count: 0,
          active_count: 0,
          total_votes: 0,
        }
        existing.topic_count++
        existing.total_votes += row.total_votes ?? 0
        if (row.status === 'law') existing.law_count++
        if (row.status === 'active' || row.status === 'voting') existing.active_count++
        tagMap.set(tag, existing)
      }
    }

    // Convert to array and sort
    const allTagsUnsorted: V1Tag[] = Array.from(tagMap.entries())
      .map(([tag, stats]) => ({
        tag,
        ...stats,
        url: `${BASE_URL}/tags/${encodeURIComponent(tag)}`,
      }))
      .filter((t) => t.topic_count >= 1)

    if (sort === 'topics') {
      allTagsUnsorted.sort((a, b) => b.topic_count - a.topic_count || b.total_votes - a.total_votes)
    } else if (sort === 'votes') {
      allTagsUnsorted.sort((a, b) => b.total_votes - a.total_votes || b.topic_count - a.topic_count)
    } else if (sort === 'laws') {
      allTagsUnsorted.sort((a, b) => b.law_count - a.law_count || b.total_votes - a.total_votes)
    } else {
      allTagsUnsorted.sort((a, b) => b.active_count - a.active_count || b.topic_count - a.topic_count)
    }
    const allTags = allTagsUnsorted

    const total = allTags.length
    const paginated = allTags.slice(offset, offset + limit)

    const response: V1TagsResponse = {
      data: paginated,
      meta: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/tags]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
