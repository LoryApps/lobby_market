import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { Thesis, ThesisAuthor, ThesisListResponse, ThesisStatus, ThesisCategory } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

// Re-export so callers that only need types can import from here
export type { Thesis, ThesisAuthor, ThesisListResponse, ThesisStatus, ThesisCategory }
export { THESIS_CATEGORIES }

const VALID_SORTS = ['newest', 'popular', 'expiring', 'contested']
const VALID_STATUSES: ThesisStatus[] = ['active', 'vindicated', 'refuted', 'expired']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const category = searchParams.get('category') || null
  const sort = searchParams.get('sort') || 'newest'
  const status = searchParams.get('status') || 'active'
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 60)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const authorId = searchParams.get('author_id') || null
  const topicId = searchParams.get('topic_id') || null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_theses')
    .select(
      `
      id, user_id, statement, rationale, category,
      resolution_date, status, related_topic_id,
      agree_count, disagree_count, is_public, resolved_at,
      created_at, updated_at,
      profiles!civic_theses_user_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `,
      { count: 'exact' }
    )
    .eq('is_public', true)

  if (category && THESIS_CATEGORIES.includes(category as ThesisCategory)) {
    query = query.eq('category', category)
  }
  if (status && VALID_STATUSES.includes(status as ThesisStatus)) {
    query = query.eq('status', status)
  }
  if (authorId) {
    query = query.eq('user_id', authorId)
  }
  if (topicId) {
    query = query.eq('related_topic_id', topicId)
  }

  if (VALID_SORTS.includes(sort)) {
    if (sort === 'newest') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'popular') {
      query = query.order('agree_count', { ascending: false })
    } else if (sort === 'expiring') {
      query = query
        .not('resolution_date', 'is', null)
        .order('resolution_date', { ascending: true })
    } else if (sort === 'contested') {
      query = query.order('disagree_count', { ascending: false })
    }
  }

  query = query.range(offset, offset + limit - 1)

  const { data: rows, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Viewer votes
  let viewerVotes: Record<string, boolean> = {}
  if (user && rows && rows.length > 0) {
    const ids = rows.map((r) => r.id)
    const { data: voteRows } = await supabase
      .from('thesis_votes')
      .select('thesis_id, agree')
      .eq('user_id', user.id)
      .in('thesis_id', ids)
    for (const v of voteRows ?? []) {
      viewerVotes[v.thesis_id] = v.agree
    }
  }

  // Related topic statements
  const topicIds = [
    ...new Set((rows ?? []).map((r) => r.related_topic_id).filter(Boolean)),
  ] as string[]
  let topicStatements: Record<string, string> = {}
  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', topicIds)
    for (const t of topicRows ?? []) {
      topicStatements[t.id] = t.statement
    }
  }

  // Stats (across all public theses, ignoring current filter)
  const { data: statsRows } = await supabase
    .from('civic_theses')
    .select('status')
    .eq('is_public', true)

  const stats = (statsRows ?? []).reduce(
    (acc, r) => {
      if (r.status === 'active') acc.total_active++
      else if (r.status === 'vindicated') acc.total_vindicated++
      else if (r.status === 'refuted') acc.total_refuted++
      return acc
    },
    { total_active: 0, total_vindicated: 0, total_refuted: 0 }
  )

  const theses: Thesis[] = (rows ?? []).map((r) => {
    const author = Array.isArray(r.profiles)
      ? (r.profiles[0] as ThesisAuthor | null) ?? null
      : (r.profiles as ThesisAuthor | null)
    return {
      id: r.id,
      user_id: r.user_id,
      statement: r.statement,
      rationale: r.rationale,
      category: r.category,
      resolution_date: r.resolution_date,
      status: r.status as ThesisStatus,
      related_topic_id: r.related_topic_id,
      agree_count: r.agree_count,
      disagree_count: r.disagree_count,
      is_public: r.is_public,
      resolved_at: r.resolved_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: author
        ? {
            id: author.id,
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
            role: author.role,
          }
        : null,
      viewer_vote: r.id in viewerVotes ? viewerVotes[r.id] : null,
      related_topic_statement: r.related_topic_id
        ? topicStatements[r.related_topic_id] ?? null
        : null,
    }
  })

  return NextResponse.json({ theses, total: count ?? 0, stats } satisfies ThesisListResponse)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    statement?: string
    rationale?: string
    category?: string
    resolution_date?: string
    related_topic_id?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { statement, rationale, category, resolution_date, related_topic_id } = body

  if (!statement || typeof statement !== 'string') {
    return NextResponse.json({ error: 'statement is required' }, { status: 400 })
  }
  const stmt = statement.trim()
  if (stmt.length < 10 || stmt.length > 280) {
    return NextResponse.json(
      { error: 'statement must be 10–280 characters' },
      { status: 400 }
    )
  }

  const cat = (category || 'politics').toLowerCase()
  if (!THESIS_CATEGORIES.includes(cat as ThesisCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('civic_theses')
    .insert({
      user_id: user.id,
      statement: stmt,
      rationale: rationale?.trim() || null,
      category: cat,
      resolution_date: resolution_date || null,
      related_topic_id: related_topic_id || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ thesis: data }, { status: 201 })
}
