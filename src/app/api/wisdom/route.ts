import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WisdomArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  citation_count: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface WisdomResponse {
  arguments: WisdomArgument[]
  total: number
  limit: number
  offset: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

type AuthorityRole = 'elder' | 'senator' | 'lawmaker' | 'troll_catcher' | 'debator'

const TIER_ROLES: Record<string, AuthorityRole[]> = {
  all:      ['elder', 'senator', 'lawmaker', 'troll_catcher', 'debator'],
  veteran:  ['elder', 'senator', 'lawmaker'],
  lawmaker: ['elder', 'senator', 'lawmaker'],
  elder:    ['elder', 'senator'],
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * GET /api/wisdom
 *
 * Returns top arguments from high-authority platform members.
 *
 * Query params:
 *   tier      — 'all' | 'veteran' | 'elder'  (default: 'all')
 *   side      — 'for' | 'against' | 'all'    (default: 'all')
 *   category  — one of CATEGORIES or ''      (default: '' = all)
 *   sort      — 'upvotes' | 'citations' | 'recent' (default: 'upvotes')
 *   limit     — 1..50                        (default: 20)
 *   offset    — ≥0                           (default: 0)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const rawTier = searchParams.get('tier') ?? 'all'
  const tier = Object.keys(TIER_ROLES).includes(rawTier) ? rawTier : 'all'
  const roles = TIER_ROLES[tier]

  const rawSide = searchParams.get('side') ?? 'all'
  const side = ['for', 'against', 'all'].includes(rawSide) ? rawSide : 'all'

  const rawCategory = searchParams.get('category') ?? ''
  const category = CATEGORIES.includes(rawCategory) ? rawCategory : ''

  const rawSort = searchParams.get('sort') ?? 'upvotes'
  const sort = ['upvotes', 'citations', 'recent'].includes(rawSort) ? rawSort : 'upvotes'

  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  const supabase = await createClient()

  // 1. Get author IDs for the requested authority tier
  const { data: authors, error: authorsErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score')
    .in('role', roles)
    .order('reputation_score', { ascending: false })

  if (authorsErr || !authors || authors.length === 0) {
    return NextResponse.json({ arguments: [], total: 0, limit, offset } satisfies WisdomResponse)
  }

  const authorIds = authors.map((a) => a.id)
  const authorMap = new Map(authors.map((a) => [a.id, a]))

  // 2. Fetch arguments from those authors
  let query = supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, citation_count, created_at', { count: 'exact' })
    .in('user_id', authorIds)
    .gt('upvotes', 0)

  if (side === 'for') query = query.eq('side', 'blue')
  else if (side === 'against') query = query.eq('side', 'red')

  // Sorting
  if (sort === 'citations') {
    query = query.order('citation_count', { ascending: false }).order('upvotes', { ascending: false })
  } else if (sort === 'recent') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit + 20 - 1) // over-fetch to allow topic filtering

  const { data: args, count, error: argsErr } = await query

  if (argsErr || !args || args.length === 0) {
    return NextResponse.json({ arguments: [], total: 0, limit, offset } satisfies WisdomResponse)
  }

  // 3. Fetch topics for those arguments
  const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))

  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  if (category) topicsQuery = topicsQuery.eq('category', category)

  const { data: topics } = await topicsQuery

  const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

  // 4. Join, filter, and slice
  const filtered: WisdomArgument[] = args
    .filter((a) => topicMap.has(a.topic_id))
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      topic_id: a.topic_id,
      user_id: a.user_id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      citation_count: (a as { citation_count?: number }).citation_count ?? 0,
      created_at: a.created_at,
      author: authorMap.get(a.user_id) ?? null,
      topic: topicMap.get(a.topic_id) ?? null,
    }))

  return NextResponse.json({
    arguments: filtered,
    total: count ?? filtered.length,
    limit,
    offset,
  } satisfies WisdomResponse)
}
