import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface BookmarkedTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number | null
  created_at: string
  bookmarked_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface BookmarkedTopicsResponse {
  topics: BookmarkedTopic[]
  total: number
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get bookmarks ordered by save time (most recent first)
  const { data: bookmarkRows, error: bmError } = await supabase
    .from('topic_bookmarks')
    .select('topic_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (bmError) {
    return NextResponse.json({ error: bmError.message }, { status: 500 })
  }

  const rows = bookmarkRows ?? []
  if (rows.length === 0) {
    return NextResponse.json({ topics: [], total: 0 } satisfies BookmarkedTopicsResponse)
  }

  const topicIds = rows.map((r) => r.topic_id)

  // Fetch full topic data
  const { data: topicRows, error: topicError } = await supabase
    .from('topics')
    .select(
      'id, statement, description, category, scope, status, blue_pct, total_votes, feed_score, created_at, created_by'
    )
    .in('id', topicIds)

  if (topicError) {
    return NextResponse.json({ error: topicError.message }, { status: 500 })
  }

  const topicMap = new Map<string, (typeof topicRows extends (infer T)[] | null ? T : never)>()
  for (const t of topicRows ?? []) {
    topicMap.set(t.id, t)
  }

  // Fetch author profiles
  const authorIds = Array.from(
    new Set((topicRows ?? []).map((t) => (t as { created_by: string }).created_by).filter(Boolean))
  )
  const profileMap = new Map<string, {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }>()
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }
  }

  // Assemble in bookmark order
  const topics: BookmarkedTopic[] = rows
    .map((bm) => {
      const t = topicMap.get(bm.topic_id)
      if (!t) return null
      const createdBy = (t as { created_by?: string | null }).created_by
      return {
        id: t.id,
        statement: t.statement,
        description: (t as { description?: string | null }).description ?? null,
        category: t.category,
        scope: t.scope,
        status: t.status,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        feed_score: (t as { feed_score?: number | null }).feed_score ?? null,
        created_at: t.created_at,
        bookmarked_at: bm.created_at,
        author: createdBy ? (profileMap.get(createdBy) ?? null) : null,
      }
    })
    .filter((x): x is BookmarkedTopic => x !== null)

  return NextResponse.json({
    topics,
    total: topics.length,
  } satisfies BookmarkedTopicsResponse)
}
