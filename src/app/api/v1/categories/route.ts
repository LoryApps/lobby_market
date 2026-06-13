import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1Category {
  name: string
  topic_count: number
  law_count: number
  active_count: number
  proposed_count: number
  total_votes: number
  avg_for_pct: number
  top_topic: {
    id: string
    statement: string
    total_votes: number
    for_pct: number
    status: string
    url: string
  } | null
  url: string
}

export interface V1CategoriesResponse {
  data: V1Category[]
  meta: {
    total: number
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

const CANONICAL_CATEGORIES = [
  'Politics',
  'Technology',
  'Ethics',
  'Culture',
  'Economics',
  'Science',
  'Philosophy',
  'Health',
  'Environment',
  'Education',
]

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .not('category', 'is', null)
      .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })

    if (error) throw error

    // Build category stats
    const catMap = new Map<
      string,
      {
        topic_count: number
        law_count: number
        active_count: number
        proposed_count: number
        total_votes: number
        for_pct_sum: number
        for_pct_count: number
        top_topic: (typeof data)[0] | null
      }
    >()

    // Initialise canonical categories so they always appear even with 0 topics
    for (const cat of CANONICAL_CATEGORIES) {
      catMap.set(cat, {
        topic_count: 0,
        law_count: 0,
        active_count: 0,
        proposed_count: 0,
        total_votes: 0,
        for_pct_sum: 0,
        for_pct_count: 0,
        top_topic: null,
      })
    }

    for (const row of data ?? []) {
      const cat = row.category
      if (!cat) continue

      const existing = catMap.get(cat) ?? {
        topic_count: 0,
        law_count: 0,
        active_count: 0,
        proposed_count: 0,
        total_votes: 0,
        for_pct_sum: 0,
        for_pct_count: 0,
        top_topic: null,
      }

      existing.topic_count++
      existing.total_votes += row.total_votes ?? 0

      if (row.status === 'law') existing.law_count++
      if (row.status === 'active' || row.status === 'voting') existing.active_count++
      if (row.status === 'proposed') existing.proposed_count++

      if (row.blue_pct != null) {
        existing.for_pct_sum += row.blue_pct
        existing.for_pct_count++
      }

      // Top topic = highest vote count non-failed
      if (
        row.status !== 'failed' &&
        (existing.top_topic == null ||
          (row.total_votes ?? 0) > (existing.top_topic.total_votes ?? 0))
      ) {
        existing.top_topic = row
      }

      catMap.set(cat, existing)
    }

    const categories: V1Category[] = Array.from(catMap.entries())
      .map(([name, stats]) => ({
        name,
        topic_count: stats.topic_count,
        law_count: stats.law_count,
        active_count: stats.active_count,
        proposed_count: stats.proposed_count,
        total_votes: stats.total_votes,
        avg_for_pct:
          stats.for_pct_count > 0
            ? Math.round((stats.for_pct_sum / stats.for_pct_count) * 10) / 10
            : 50,
        top_topic: stats.top_topic
          ? {
              id: stats.top_topic.id,
              statement: stats.top_topic.statement,
              total_votes: stats.top_topic.total_votes ?? 0,
              for_pct: stats.top_topic.blue_pct ?? 50,
              status: stats.top_topic.status,
              url: `${BASE_URL}/topic/${stats.top_topic.id}`,
            }
          : null,
        url: `${BASE_URL}/categories/${encodeURIComponent(name.toLowerCase())}`,
      }))
      // Sort by total engagement
      .sort((a, b) => b.total_votes - a.total_votes || b.topic_count - a.topic_count)

    const response: V1CategoriesResponse = {
      data: categories,
      meta: {
        total: categories.length,
        updated_at: new Date().toISOString(),
      },
    }

    return NextResponse.json(response, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/categories]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
