import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepthArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  engagement_score: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  preview_replies: Array<{
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
  }>
}

export interface DepthStats {
  total_arguments: number
  total_replies: number
  blue_arguments: number
  red_arguments: number
  blue_total_replies: number
  red_total_replies: number
  avg_replies_per_argument: number
  max_replies: number
  arguments_with_replies: number
  arguments_no_replies: number
  highly_discussed: number
  reply_buckets: {
    zero: number
    one: number
    two_to_four: number
    five_plus: number
  }
}

export interface DepthResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  top_discussed: DepthArgument[]
  lonely_arguments: DepthArgument[]
  stats: DepthStats
}

// GET /api/topics/[id]/depth
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const [topicResult, argsResult] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
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
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  if (!topicResult.data) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic = topicResult.data
  const args = argsResult.data ?? []

  const empty: DepthResponse = {
    topic,
    top_discussed: [],
    lonely_arguments: [],
    stats: {
      total_arguments: 0,
      total_replies: 0,
      blue_arguments: 0,
      red_arguments: 0,
      blue_total_replies: 0,
      red_total_replies: 0,
      avg_replies_per_argument: 0,
      max_replies: 0,
      arguments_with_replies: 0,
      arguments_no_replies: 0,
      highly_discussed: 0,
      reply_buckets: { zero: 0, one: 0, two_to_four: 0, five_plus: 0 },
    },
  }

  if (args.length === 0) {
    return NextResponse.json(empty)
  }

  const argIds = args.map((a) => a.id)

  // Fetch all replies for this topic
  const { data: allReplies } = await supabase
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

  const replies = allReplies ?? []

  // Build reply map per argument
  type ReplyRow = (typeof replies)[number]
  const replyMap = new Map<string, ReplyRow[]>()
  for (const r of replies) {
    const list = replyMap.get(r.argument_id) ?? []
    list.push(r)
    replyMap.set(r.argument_id, list)
  }

  function coerceAuthor(raw: unknown): DepthArgument['author'] {
    if (!raw) return null
    const obj = Array.isArray(raw) ? raw[0] : raw
    if (!obj || typeof obj !== 'object') return null
    const o = obj as Record<string, unknown>
    return {
      id: String(o.id ?? ''),
      username: String(o.username ?? ''),
      display_name: o.display_name ? String(o.display_name) : null,
      avatar_url: o.avatar_url ? String(o.avatar_url) : null,
      role: String(o.role ?? 'person'),
    }
  }

  // Enrich arguments with reply counts
  type RawArg = (typeof args)[number]
  const enriched = args.map((a: RawArg) => {
    const argReplies = replyMap.get(a.id) ?? []
    const reply_count = argReplies.length
    // Engagement score: weighted combo of replies and upvotes
    const engagement_score = reply_count * 3 + (a.upvotes ?? 0)
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes ?? 0,
      reply_count,
      engagement_score,
      created_at: a.created_at,
      author: coerceAuthor(a.author),
      preview_replies: argReplies.slice(0, 3).map((r) => ({
        id: r.id,
        content: r.content,
        created_at: r.created_at,
        author: coerceAuthor(r.author),
      })),
    }
  })

  // Top 10 most discussed (most replies, then engagement_score)
  const top_discussed = [...enriched]
    .filter((a) => a.reply_count > 0)
    .sort((a, b) => b.reply_count - a.reply_count || b.engagement_score - a.engagement_score)
    .slice(0, 10)

  // Arguments with 0 replies but high upvotes ("silent hits")
  const lonely_arguments = [...enriched]
    .filter((a) => a.reply_count === 0 && a.upvotes > 0)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)

  // Build stats
  const blueArgs = enriched.filter((a) => a.side === 'blue')
  const redArgs = enriched.filter((a) => a.side === 'red')
  const totalReplies = replies.length
  const blueReplies = blueArgs.reduce((s, a) => s + a.reply_count, 0)
  const redReplies = redArgs.reduce((s, a) => s + a.reply_count, 0)
  const maxReplies = enriched.reduce((m, a) => Math.max(m, a.reply_count), 0)
  const withReplies = enriched.filter((a) => a.reply_count > 0).length
  const noReplies = enriched.length - withReplies
  const highlyDiscussed = enriched.filter((a) => a.reply_count >= 5).length

  const reply_buckets = {
    zero: enriched.filter((a) => a.reply_count === 0).length,
    one: enriched.filter((a) => a.reply_count === 1).length,
    two_to_four: enriched.filter((a) => a.reply_count >= 2 && a.reply_count <= 4).length,
    five_plus: enriched.filter((a) => a.reply_count >= 5).length,
  }

  const stats: DepthStats = {
    total_arguments: enriched.length,
    total_replies: totalReplies,
    blue_arguments: blueArgs.length,
    red_arguments: redArgs.length,
    blue_total_replies: blueReplies,
    red_total_replies: redReplies,
    avg_replies_per_argument: enriched.length > 0 ? totalReplies / enriched.length : 0,
    max_replies: maxReplies,
    arguments_with_replies: withReplies,
    arguments_no_replies: noReplies,
    highly_discussed: highlyDiscussed,
    reply_buckets,
  }

  return NextResponse.json({
    topic,
    top_discussed,
    lonely_arguments,
    stats,
  } satisfies DepthResponse)
}
