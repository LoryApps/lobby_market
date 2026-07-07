import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ClipArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
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
  reply_count: number
}

export interface ClipsResponse {
  clips: ClipArgument[]
  total: number
}

/**
 * GET /api/arguments/clips
 *
 * Returns top arguments formatted for the Civic Clips experience.
 * Prioritises high-upvote, well-scored arguments with rich content.
 *
 * Query params:
 *   limit    — number of clips (default 30, max 60)
 *   offset   — pagination offset (default 0)
 *   side     — 'for' | 'against' | 'all' (default 'all')
 *   category — category name or 'all' (default 'all')
 *   sort     — 'top' | 'new' | 'ai_score' (default 'top')
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '30'), 60)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 30
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0)
  const side = searchParams.get('side') ?? 'all'
  const category = searchParams.get('category') ?? 'all'
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  // Build the query — join topic and author inline
  let query = supabase
    .from('topic_arguments')
    .select(`
      id,
      topic_id,
      side,
      content,
      upvotes,
      ai_score,
      ai_grade,
      created_at,
      user_id,
      profiles!topic_arguments_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url,
        role
      ),
      topics!topic_arguments_topic_id_fkey (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    // Only show arguments with decent engagement
    .gte('upvotes', 1)
    // Only show arguments on active/voting/law topics
    .not('topics', 'is', null)

  // Side filter
  if (side === 'for') query = query.eq('side', 'blue')
  else if (side === 'against') query = query.eq('side', 'red')

  // Sort
  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'ai_score') {
    query = query.order('ai_score', { ascending: false, nullsFirst: false }).order('upvotes', { ascending: false })
  } else {
    // 'top' — most upvoted
    query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ clips: [], total: 0 }, { status: 500 })
  }

  // Post-filter by category (can't easily do this in Supabase join filters)
  const rows = (data ?? []) as Array<{
    id: string
    topic_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    user_id: string
    profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
    topics: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number } | null
  }>

  const filtered = category === 'all'
    ? rows
    : rows.filter((r) => r.topics?.category === category)

  // Get reply counts in a separate query for the fetched IDs
  const ids = filtered.map((r) => r.id)
  const replyCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: replyData } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', ids)

    if (replyData) {
      for (const row of replyData) {
        replyCounts[row.argument_id] = (replyCounts[row.argument_id] ?? 0) + 1
      }
    }
  }

  const clips: ClipArgument[] = filtered.map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    side: row.side,
    content: row.content,
    upvotes: row.upvotes,
    ai_score: row.ai_score,
    ai_grade: row.ai_grade,
    created_at: row.created_at,
    author: row.profiles
      ? {
          id: row.profiles.id,
          username: row.profiles.username,
          display_name: row.profiles.display_name,
          avatar_url: row.profiles.avatar_url,
          role: row.profiles.role,
        }
      : null,
    topic: row.topics
      ? {
          id: row.topics.id,
          statement: row.topics.statement,
          category: row.topics.category,
          status: row.topics.status,
          blue_pct: row.topics.blue_pct,
          total_votes: row.topics.total_votes,
        }
      : null,
    reply_count: replyCounts[row.id] ?? 0,
  }))

  return NextResponse.json({
    clips,
    total: clips.length,
  } satisfies ClipsResponse)
}
