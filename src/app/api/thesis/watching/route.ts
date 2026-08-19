import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface WatchingThesisResponse {
  theses: Thesis[]
  total: number
  isLoggedIn: boolean
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ theses: [], total: 0, isLoggedIn: false } satisfies WatchingThesisResponse)
  }

  const { searchParams } = req.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 60)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const status = searchParams.get('status') || null

  const { data: watchRows } = await supabase
    .from('thesis_watchlist')
    .select('thesis_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!watchRows || watchRows.length === 0) {
    return NextResponse.json({ theses: [], total: 0, isLoggedIn: true } satisfies WatchingThesisResponse)
  }

  const thesisIds = watchRows.map((r) => r.thesis_id)
  const watchedAtMap: Record<string, string> = {}
  for (const r of watchRows) watchedAtMap[r.thesis_id] = r.created_at

  let query = supabase
    .from('civic_theses')
    .select(`
      id, user_id, statement, rationale, category, resolution_date,
      status, related_topic_id, agree_count, disagree_count, is_public,
      resolved_at, created_at, updated_at,
      author:profiles!civic_theses_user_id_fkey (
        id, username, display_name, avatar_url, role
      ),
      related_topic:topics!civic_theses_related_topic_id_fkey (
        statement
      ),
      viewer_vote:thesis_votes!left (
        agree
      )
    `)
    .in('id', thesisIds)
    .eq('is_public', true)

  if (status) query = query.eq('status', status)

  const { data: rows, error } = await query
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const theses: Thesis[] = (rows ?? []).map((r) => {
    const voteRows = (r.viewer_vote ?? []) as { agree: boolean }[]
    const myVoteRow = voteRows.find(() => true)
    const author = r.author as unknown as ThesisAuthor | null

    return {
      id: r.id,
      user_id: r.user_id,
      statement: r.statement,
      rationale: r.rationale ?? null,
      category: r.category,
      resolution_date: r.resolution_date ?? null,
      status: r.status as Thesis['status'],
      related_topic_id: r.related_topic_id ?? null,
      agree_count: r.agree_count ?? 0,
      disagree_count: r.disagree_count ?? 0,
      is_public: r.is_public ?? true,
      resolved_at: r.resolved_at ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: author ?? null,
      viewer_vote: myVoteRow != null ? myVoteRow.agree : null,
      related_topic_statement:
        r.related_topic && typeof r.related_topic === 'object' && 'statement' in r.related_topic
          ? (r.related_topic as { statement: string }).statement
          : null,
    }
  })

  // Sort by watchedAt order
  theses.sort((a, b) => {
    const ta = watchedAtMap[a.id] ?? ''
    const tb = watchedAtMap[b.id] ?? ''
    return tb.localeCompare(ta)
  })

  return NextResponse.json({
    theses,
    total: watchRows.length,
    isLoggedIn: true,
  } satisfies WatchingThesisResponse)
}
