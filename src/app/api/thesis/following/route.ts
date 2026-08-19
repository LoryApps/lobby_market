import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface FollowingThesisResponse {
  theses: Thesis[]
  total: number
  isLoggedIn: boolean
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ theses: [], total: 0, isLoggedIn: false } satisfies FollowingThesisResponse)
  }

  const { searchParams } = req.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 60)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const status = searchParams.get('status') || 'active'
  const category = searchParams.get('category') || null

  // Get IDs of users the current user follows
  const { data: followRows } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followingIds = (followRows ?? []).map((r) => r.following_id)

  if (followingIds.length === 0) {
    return NextResponse.json({ theses: [], total: 0, isLoggedIn: true } satisfies FollowingThesisResponse)
  }

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
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && ['active', 'vindicated', 'refuted', 'expired'].includes(status)) {
    query = query.eq('status', status)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data: rows, count } = await query

  const ids = (rows ?? []).map((r) => r.id)

  // Viewer's own votes
  let viewerVotes: Record<string, boolean> = {}
  if (ids.length > 0) {
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

  const theses: Thesis[] = (rows ?? []).map((r) => {
    const profileData = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const author: ThesisAuthor | null = profileData
      ? {
          id: (profileData as ThesisAuthor).id,
          username: (profileData as ThesisAuthor).username,
          display_name: (profileData as ThesisAuthor).display_name,
          avatar_url: (profileData as ThesisAuthor).avatar_url,
          role: (profileData as ThesisAuthor).role,
        }
      : null
    return {
      id: r.id,
      user_id: r.user_id,
      statement: r.statement,
      rationale: r.rationale,
      category: r.category,
      resolution_date: r.resolution_date,
      status: r.status,
      related_topic_id: r.related_topic_id,
      agree_count: r.agree_count,
      disagree_count: r.disagree_count,
      is_public: r.is_public,
      resolved_at: r.resolved_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author,
      viewer_vote: r.id in viewerVotes ? viewerVotes[r.id] : null,
      related_topic_statement: r.related_topic_id
        ? topicStatements[r.related_topic_id] ?? null
        : null,
    }
  })

  return NextResponse.json({ theses, total: count ?? 0, isLoggedIn: true } satisfies FollowingThesisResponse)
}
