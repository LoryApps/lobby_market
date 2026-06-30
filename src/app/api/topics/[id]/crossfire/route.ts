import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrossfireReply {
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

export interface CrossfireExchange {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  created_at: string
  clash_score: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  replies: CrossfireReply[]
}

export interface CrossfireData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  exchanges: CrossfireExchange[]
  stats: {
    total_arguments: number
    total_replies: number
    contested_arguments: number
    blue_contested: number
    red_contested: number
  }
}

// GET /api/topics/[id]/crossfire
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
      .order('upvotes', { ascending: false })
      .limit(60),
  ])

  if (!topicResult.data) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const args = argsResult.data ?? []

  if (args.length === 0) {
    return NextResponse.json({
      topic: topicResult.data,
      exchanges: [],
      stats: { total_arguments: 0, total_replies: 0, contested_arguments: 0, blue_contested: 0, red_contested: 0 },
    } satisfies CrossfireData)
  }

  const argIds = args.map((a) => a.id)

  // Fetch reply counts per argument
  const { data: replyCounts } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds)
    .eq('topic_id', params.id)

  const countMap = new Map<string, number>()
  for (const row of replyCounts ?? []) {
    countMap.set(row.argument_id, (countMap.get(row.argument_id) ?? 0) + 1)
  }

  // Score each argument: reply_count * (1 + upvotes * 0.5)
  const scored = args
    .map((a) => {
      const reply_count = countMap.get(a.id) ?? 0
      const clash_score = reply_count * (1 + (a.upvotes ?? 0) * 0.5)
      return { ...a, reply_count, clash_score }
    })
    .filter((a) => a.reply_count > 0)
    .sort((a, b) => b.clash_score - a.clash_score)
    .slice(0, 15)

  if (scored.length === 0) {
    return NextResponse.json({
      topic: topicResult.data,
      exchanges: [],
      stats: {
        total_arguments: args.length,
        total_replies: 0,
        contested_arguments: 0,
        blue_contested: 0,
        red_contested: 0,
      },
    } satisfies CrossfireData)
  }

  // Fetch top 3 replies for each contested argument
  const topArgIds = scored.map((a) => a.id)

  const { data: repliesRaw } = await supabase
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
    .in('argument_id', topArgIds)
    .order('created_at', { ascending: false })

  // Group replies by argument_id, keep up to 3 per argument
  const replyMap = new Map<string, CrossfireReply[]>()
  for (const row of repliesRaw ?? []) {
    const existing = replyMap.get(row.argument_id) ?? []
    if (existing.length < 3) {
      const authorRaw = row.author
      const author = Array.isArray(authorRaw)
        ? (authorRaw[0] as CrossfireReply['author']) ?? null
        : (authorRaw as CrossfireReply['author']) ?? null

      existing.push({
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        author,
      })
      replyMap.set(row.argument_id, existing)
    }
  }

  const exchanges: CrossfireExchange[] = scored.map((a) => {
    const authorRaw = a.author
    const author = Array.isArray(authorRaw)
      ? (authorRaw[0] as CrossfireExchange['author']) ?? null
      : (authorRaw as CrossfireExchange['author']) ?? null

    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes ?? 0,
      reply_count: a.reply_count,
      created_at: a.created_at,
      clash_score: a.clash_score,
      author,
      replies: replyMap.get(a.id) ?? [],
    }
  })

  const totalReplies = Array.from(countMap.values()).reduce((s, n) => s + n, 0)

  return NextResponse.json({
    topic: topicResult.data,
    exchanges,
    stats: {
      total_arguments: args.length,
      total_replies: totalReplies,
      contested_arguments: scored.length,
      blue_contested: scored.filter((a) => a.side === 'blue').length,
      red_contested: scored.filter((a) => a.side === 'red').length,
    },
  } satisfies CrossfireData)
}
