import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThreadReply {
  id: string
  content: string
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface ArgumentThread {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  latest_reply_at: string | null
  activity_score: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  top_replies: ThreadReply[]
}

export interface ThreadsData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  threads: ArgumentThread[]
  stats: {
    total_arguments: number
    total_replies: number
    active_threads: number
    blue_threads: number
    red_threads: number
  }
}

// GET /api/topics/[id]/threads
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const rawSort = searchParams.get('sort') ?? 'most_active'
  const rawSide = searchParams.get('side') ?? ''
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)

  const sort = ['most_active', 'most_replies', 'newest'].includes(rawSort) ? rawSort : 'most_active'
  const side = rawSide === 'for' ? 'blue' : rawSide === 'against' ? 'red' : ''
  const limit = Math.min(50, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit))

  const supabase = await createClient()

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch all arguments for this topic (over-fetch to allow filtering)
  let argQuery = supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      created_at,
      author:profiles!topic_arguments_user_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(200)

  if (side) argQuery = argQuery.eq('side', side)

  const { data: argRows, error: argError } = await argQuery
  if (argError) {
    return NextResponse.json({ error: argError.message }, { status: 500 })
  }

  const args = argRows ?? []
  const totalArguments = args.length

  if (totalArguments === 0) {
    return NextResponse.json({
      topic,
      threads: [],
      stats: { total_arguments: 0, total_replies: 0, active_threads: 0, blue_threads: 0, red_threads: 0 },
    } satisfies ThreadsData)
  }

  const argIds = args.map((a) => a.id)

  // Fetch all replies for these arguments
  const { data: allReplies, error: replyError } = await supabase
    .from('argument_replies')
    .select(`
      id,
      argument_id,
      content,
      created_at,
      author:profiles!argument_replies_user_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .in('argument_id', argIds)
    .eq('topic_id', params.id)
    .order('created_at', { ascending: true })

  if (replyError) {
    return NextResponse.json({ error: replyError.message }, { status: 500 })
  }

  // Build reply map: argId → replies (ordered oldest first)
  const replyMap = new Map<string, ThreadReply[]>()
  const latestReplyMap = new Map<string, string>()
  let totalReplies = 0

  for (const row of allReplies ?? []) {
    totalReplies++
    const existing = replyMap.get(row.argument_id) ?? []

    const authorRaw = row.author
    const author = Array.isArray(authorRaw)
      ? (authorRaw[0] as ThreadReply['author']) ?? null
      : (authorRaw as ThreadReply['author']) ?? null

    existing.push({
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      author,
    })
    replyMap.set(row.argument_id, existing)

    // Track latest reply per argument
    const current = latestReplyMap.get(row.argument_id)
    if (!current || row.created_at > current) {
      latestReplyMap.set(row.argument_id, row.created_at)
    }
  }

  // Build scored threads — only arguments with at least 1 reply
  const now = Date.now()
  const threads: ArgumentThread[] = args
    .filter((a) => (replyMap.get(a.id) ?? []).length > 0)
    .map((a) => {
      const replies = replyMap.get(a.id) ?? []
      const replyCount = replies.length
      const latestAt = latestReplyMap.get(a.id) ?? null
      const hoursOld = latestAt
        ? Math.max(1, (now - new Date(latestAt).getTime()) / 3_600_000)
        : 999

      // Activity score: replies * upvotes_bonus / recency_decay
      const activityScore = (replyCount * (1 + (a.upvotes ?? 0) * 0.3)) / Math.log1p(hoursOld)

      const authorRaw = a.author
      const author = Array.isArray(authorRaw)
        ? (authorRaw[0] as ArgumentThread['author']) ?? null
        : (authorRaw as ArgumentThread['author']) ?? null

      // Return top 5 replies (most recent)
      const topReplies = replies.slice(-5).reverse()

      return {
        id: a.id,
        content: a.content,
        side: a.side as 'blue' | 'red',
        upvotes: a.upvotes ?? 0,
        reply_count: replyCount,
        latest_reply_at: latestAt,
        activity_score: activityScore,
        created_at: a.created_at,
        author,
        top_replies: topReplies,
      }
    })

  // Sort by requested mode
  if (sort === 'most_active') {
    threads.sort((a, b) => b.activity_score - a.activity_score)
  } else if (sort === 'most_replies') {
    threads.sort((a, b) => b.reply_count - a.reply_count)
  } else {
    // newest thread (by latest reply)
    threads.sort((a, b) => {
      if (!a.latest_reply_at && !b.latest_reply_at) return 0
      if (!a.latest_reply_at) return 1
      if (!b.latest_reply_at) return -1
      return b.latest_reply_at.localeCompare(a.latest_reply_at)
    })
  }

  const trimmed = threads.slice(0, limit)

  const stats = {
    total_arguments: totalArguments,
    total_replies: totalReplies,
    active_threads: threads.length,
    blue_threads: threads.filter((t) => t.side === 'blue').length,
    red_threads: threads.filter((t) => t.side === 'red').length,
  }

  return NextResponse.json({ topic, threads: trimmed, stats } satisfies ThreadsData)
}
