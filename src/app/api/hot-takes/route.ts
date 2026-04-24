import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface HotTake {
  id: string
  side: 'blue' | 'red'
  reason: string
  created_at: string
  voter: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
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

export interface HotTakesResponse {
  takes: HotTake[]
  newest_at: string | null
  total: number
}

/**
 * GET /api/hot-takes
 *
 * Returns recent votes that include a free-text reason ("hot take").
 *
 * Query params:
 *   since    — ISO timestamp; only return takes created after this time
 *   limit    — max results (default 40, max 80)
 *   side     — 'for' | 'against' | 'all' (default 'all')
 *   category — category name or 'all' (default 'all')
 *   topic_id — UUID; restrict to a single topic
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since')
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '40'), 80)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 40
  const side = searchParams.get('side') ?? 'all'
  const category = searchParams.get('category') ?? 'all'
  const topicId = searchParams.get('topic_id')

  const supabase = await createClient()

  let query = supabase
    .from('votes')
    .select('id, user_id, topic_id, side, reason, created_at')
    .not('reason', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (since) {
    query = query.gt('created_at', since)
  }

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  if (side === 'for') {
    query = query.eq('side', 'blue')
  } else if (side === 'against') {
    query = query.eq('side', 'red')
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ takes: [], newest_at: null, total: 0 })
  }

  const voterIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const topicIds = Array.from(new Set(rows.map((r) => r.topic_id)))

  // When filtered to a single topic we don't need to join topics table
  const [profilesRes, topicsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', voterIds),
    topicId
      ? Promise.resolve({ data: null })
      : supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .in('id', topicIds),
  ])

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p]),
  )
  const topicMap = new Map(
    ((topicsRes.data as Array<{ id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }> | null) ?? []).map((t) => [t.id, t]),
  )

  let takes: HotTake[] = rows.map((r) => ({
    id: r.id,
    side: r.side as 'blue' | 'red',
    reason: r.reason as string,
    created_at: r.created_at,
    voter: profileMap.get(r.user_id) ?? null,
    topic: topicId ? null : (topicMap.get(r.topic_id) ?? null),
  }))

  // Apply category filter after join (topics are already fetched)
  if (category !== 'all' && !topicId) {
    takes = takes.filter(
      (t) => t.topic?.category?.toLowerCase() === category.toLowerCase(),
    )
  }

  const newest_at = takes.length > 0 ? takes[0].created_at : null

  return NextResponse.json({ takes, newest_at, total: takes.length })
}
