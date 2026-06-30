import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaultLineArg {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  ai_grade: string | null
  ai_score: number | null
  created_at: string
  // derived
  tension_ratio: number   // reply_count / (upvotes + 1)
}

export interface FaultLinesData {
  topic_id: string
  topic_statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number

  total_arguments: number
  total_replies: number
  avg_replies_per_arg: number
  most_contested_side: 'blue' | 'red' | 'equal'

  // Most-replied arguments — the debate lightning rods
  flashpoints: FaultLineArg[]

  // High upvotes, zero replies — accepted as given, not challenged
  dead_certainties: FaultLineArg[]

  // High reply-to-upvote ratio — argued more than praised
  contested_ground: FaultLineArg[]

  // Earliest arguments posted — did the founding arguments hold up?
  first_movers: FaultLineArg[]

  unavailable?: boolean
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Fetch all arguments
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, ai_grade, ai_score, created_at')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(200)

  const allArgs = rawArgs ?? []

  if (allArgs.length < 2) {
    return NextResponse.json({
      topic_id: topic.id,
      topic_statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      total_arguments: allArgs.length,
      total_replies: 0,
      avg_replies_per_arg: 0,
      most_contested_side: 'equal',
      flashpoints: [],
      dead_certainties: [],
      contested_ground: [],
      first_movers: [],
      unavailable: true,
    } satisfies FaultLinesData)
  }

  // Fetch reply counts for each argument
  const argIds = allArgs.map((a) => a.id)
  const replyCounts = new Map<string, number>()

  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)

    for (const r of replies ?? []) {
      replyCounts.set(r.argument_id, (replyCounts.get(r.argument_id) ?? 0) + 1)
    }
  }

  // Enrich arguments with reply counts and tension ratio
  const enriched: FaultLineArg[] = allArgs.map((a) => {
    const reply_count = replyCounts.get(a.id) ?? 0
    const upvotes = a.upvotes ?? 0
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes,
      reply_count,
      ai_grade: a.ai_grade ?? null,
      ai_score: a.ai_score ?? null,
      created_at: a.created_at,
      tension_ratio: reply_count / (upvotes + 1),
    }
  })

  const totalReplies = [...replyCounts.values()].reduce((s, v) => s + v, 0)

  // ── Flashpoints: most-replied arguments ──────────────────────────────────
  const flashpoints = [...enriched]
    .sort((a, b) => b.reply_count - a.reply_count || b.upvotes - a.upvotes)
    .filter((a) => a.reply_count > 0)
    .slice(0, 6)

  // ── Dead Certainties: high upvotes, zero replies ──────────────────────────
  const dead_certainties = [...enriched]
    .filter((a) => a.reply_count === 0 && a.upvotes >= 1)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 6)

  // ── Contested Ground: high reply-to-upvote ratio ──────────────────────────
  const contested_ground = [...enriched]
    .filter((a) => a.reply_count >= 2)
    .sort((a, b) => b.tension_ratio - a.tension_ratio || b.reply_count - a.reply_count)
    .slice(0, 6)

  // ── First Movers: earliest arguments ─────────────────────────────────────
  const first_movers = [...enriched]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 6)

  // ── Most contested side ───────────────────────────────────────────────────
  const forReplies = enriched
    .filter((a) => a.side === 'blue')
    .reduce((s, a) => s + a.reply_count, 0)
  const againstReplies = enriched
    .filter((a) => a.side === 'red')
    .reduce((s, a) => s + a.reply_count, 0)

  const most_contested_side: 'blue' | 'red' | 'equal' =
    forReplies > againstReplies + 2
      ? 'blue'
      : againstReplies > forReplies + 2
        ? 'red'
        : 'equal'

  const data: FaultLinesData = {
    topic_id: topic.id,
    topic_statement: topic.statement,
    category: topic.category,
    status: topic.status,
    blue_pct: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,

    total_arguments: allArgs.length,
    total_replies: totalReplies,
    avg_replies_per_arg:
      allArgs.length > 0
        ? Math.round((totalReplies / allArgs.length) * 10) / 10
        : 0,
    most_contested_side,

    flashpoints,
    dead_certainties,
    contested_ground,
    first_movers,
  }

  return NextResponse.json(data)
}
