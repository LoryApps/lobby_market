import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateMapArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  reply_count: number
  char_count: number
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  created_at: string
}

export interface DebateMapStats {
  total: number
  for_count: number
  against_count: number
  max_upvotes: number
  avg_upvotes: number
  graded_count: number
  avg_ai_score: number | null
  top_for_id: string | null
  top_against_id: string | null
}

export interface DebateMapResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  arguments: DebateMapArgument[]
  stats: DebateMapStats
}

// ─── GET /api/topics/[id]/debate-map ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch topic metadata
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch all top-level arguments with author info (limit 200 for performance)
  const { data: args, error: argsErr } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      ai_score,
      ai_grade,
      created_at,
      profiles (
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .eq('topic_id', topicId)
    .is('parent_id', null)
    .order('upvotes', { ascending: false })
    .limit(200)

  if (argsErr) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const rawArgs = (args ?? []) as Array<{
    id: string
    content: string
    side: string
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }>

  // Fetch reply counts for all arguments in one query
  const argIds = rawArgs.map((a) => a.id)
  const replyCountMap = new Map<string, number>()

  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('topic_arguments')
      .select('parent_id')
      .in('parent_id', argIds)

    for (const r of replies ?? []) {
      if (r.parent_id) {
        replyCountMap.set(r.parent_id, (replyCountMap.get(r.parent_id) ?? 0) + 1)
      }
    }
  }

  // Build typed argument list
  const arguments_: DebateMapArgument[] = rawArgs.map((a) => ({
    id: a.id,
    content: a.content,
    side: (a.side === 'blue' ? 'blue' : 'red') as 'blue' | 'red',
    upvotes: a.upvotes ?? 0,
    ai_score: a.ai_score ?? null,
    ai_grade: a.ai_grade ?? null,
    reply_count: replyCountMap.get(a.id) ?? 0,
    char_count: a.content.length,
    author: a.profiles
      ? {
          username: a.profiles.username,
          display_name: a.profiles.display_name,
          avatar_url: a.profiles.avatar_url,
          role: a.profiles.role,
        }
      : null,
    created_at: a.created_at,
  }))

  // Compute stats
  const forArgs = arguments_.filter((a) => a.side === 'blue')
  const againstArgs = arguments_.filter((a) => a.side === 'red')
  const maxUpvotes = arguments_.reduce((m, a) => Math.max(m, a.upvotes), 0)
  const avgUpvotes =
    arguments_.length > 0
      ? arguments_.reduce((s, a) => s + a.upvotes, 0) / arguments_.length
      : 0
  const graded = arguments_.filter((a) => a.ai_score !== null)
  const avgAiScore =
    graded.length > 0
      ? graded.reduce((s, a) => s + (a.ai_score ?? 0), 0) / graded.length
      : null

  const topFor = forArgs.reduce(
    (best, a) => (!best || a.upvotes > best.upvotes ? a : best),
    null as DebateMapArgument | null
  )
  const topAgainst = againstArgs.reduce(
    (best, a) => (!best || a.upvotes > best.upvotes ? a : best),
    null as DebateMapArgument | null
  )

  const stats: DebateMapStats = {
    total: arguments_.length,
    for_count: forArgs.length,
    against_count: againstArgs.length,
    max_upvotes: maxUpvotes,
    avg_upvotes: Math.round(avgUpvotes * 10) / 10,
    graded_count: graded.length,
    avg_ai_score: avgAiScore !== null ? Math.round(avgAiScore * 10) / 10 : null,
    top_for_id: topFor?.id ?? null,
    top_against_id: topAgainst?.id ?? null,
  }

  return NextResponse.json({
    topic,
    arguments: arguments_,
    stats,
  } satisfies DebateMapResponse)
}
