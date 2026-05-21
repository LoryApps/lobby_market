import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TOPIC_COLS = `
  id, statement, description, category, scope, status,
  blue_pct, total_votes, support_count, activation_threshold,
  voting_ends_at, feed_score, view_count, created_at
`.trim()

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const STATUSES = ['proposed', 'active', 'voting', 'law', 'failed']
const SCOPES = ['Global', 'National', 'Regional', 'Local']

type SortMode = 'votes' | 'new' | 'trending' | 'near_law' | 'contested'

export interface BrowseTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string | null
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  feed_score: number
  view_count: number
  created_at: string
}

export interface BrowseResponse {
  topics: BrowseTopic[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  filters: {
    status: string | null
    category: string | null
    scope: string | null
    sort: SortMode
    query: string | null
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const statusParam = searchParams.get('status')
  const categoryParam = searchParams.get('category')
  const scopeParam = searchParams.get('scope')
  const sortParam = (searchParams.get('sort') ?? 'votes') as SortMode
  const queryParam = searchParams.get('q')?.trim() || null
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(30, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)))

  // Validate filters
  const status = statusParam && STATUSES.includes(statusParam) ? statusParam : null
  const category = categoryParam && CATEGORIES.includes(categoryParam) ? categoryParam : null
  const scope = scopeParam && SCOPES.includes(scopeParam) ? scopeParam : null

  try {
    let query = supabase
      .from('topics')
      .select(TOPIC_COLS, { count: 'exact' })

    // Status filter — default to active content (not failed)
    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['proposed', 'active', 'voting', 'law'])
    }

    if (category) query = query.eq('category', category)
    if (scope) query = query.eq('scope', scope)

    // Full-text search via ilike (works without FTS index)
    if (queryParam && queryParam.length >= 2) {
      query = query.ilike('statement', `%${queryParam}%`)
    }

    // Sorting
    switch (sortParam) {
      case 'new':
        query = query.order('created_at', { ascending: false })
        break
      case 'trending':
        query = query.order('feed_score', { ascending: false })
        break
      case 'near_law':
        // Topics closest to becoming law: active/voting with high blue_pct or near threshold
        query = query
          .in('status', ['active', 'voting', 'proposed'])
          .order('blue_pct', { ascending: false })
          .order('total_votes', { ascending: false })
        break
      case 'contested':
        // Topics where blue_pct is closest to 50%
        query = query.order('total_votes', { ascending: false })
        break
      case 'votes':
      default:
        query = query.order('total_votes', { ascending: false })
        break
    }

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let topics = (data ?? []) as BrowseTopic[]

    // Post-process contested sort (closest to 50%)
    if (sortParam === 'contested' && !queryParam) {
      topics = topics.sort((a, b) => {
        const distA = Math.abs(50 - a.blue_pct)
        const distB = Math.abs(50 - b.blue_pct)
        return distA - distB
      })
    }

    const total = count ?? 0

    return NextResponse.json({
      topics,
      total,
      page,
      pageSize,
      hasMore: from + pageSize < total,
      filters: { status, category, scope, sort: sortParam, query: queryParam },
    } satisfies BrowseResponse)
  } catch (err) {
    console.error('topics/browse error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
