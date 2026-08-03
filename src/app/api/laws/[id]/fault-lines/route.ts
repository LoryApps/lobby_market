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
  tension_ratio: number
}

export interface LawFaultLinesData {
  law_id: string
  topic_id: string
  law_statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string

  total_arguments: number
  total_replies: number
  avg_replies_per_arg: number
  most_contested_side: 'blue' | 'red' | 'equal'

  flashpoints: FaultLineArg[]
  dead_certainties: FaultLineArg[]
  contested_ground: FaultLineArg[]
  first_movers: FaultLineArg[]

  unavailable?: boolean
}

// ─── GET /api/laws/[id]/fault-lines ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  if (!law.topic_id) {
    return NextResponse.json({
      law_id: law.id,
      topic_id: '',
      law_statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      total_arguments: 0,
      total_replies: 0,
      avg_replies_per_arg: 0,
      most_contested_side: 'equal',
      flashpoints: [],
      dead_certainties: [],
      contested_ground: [],
      first_movers: [],
      unavailable: true,
    } satisfies LawFaultLinesData)
  }

  // Fetch arguments for the original topic
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, ai_grade, ai_score, created_at')
    .eq('topic_id', law.topic_id)
    .order('upvotes', { ascending: false })
    .limit(200)

  const allArgs = rawArgs ?? []

  if (allArgs.length < 2) {
    return NextResponse.json({
      law_id: law.id,
      topic_id: law.topic_id,
      law_statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      total_arguments: allArgs.length,
      total_replies: 0,
      avg_replies_per_arg: 0,
      most_contested_side: 'equal',
      flashpoints: [],
      dead_certainties: [],
      contested_ground: [],
      first_movers: [],
      unavailable: true,
    } satisfies LawFaultLinesData)
  }

  // Fetch reply counts
  const argIds = allArgs.map((a) => a.id)
  const replyCounts = new Map<string, number>()

  const { data: replies } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds.slice(0, 200))

  for (const r of replies ?? []) {
    replyCounts.set(r.argument_id, (replyCounts.get(r.argument_id) ?? 0) + 1)
  }

  // Enrich args with derived fields
  const enriched: FaultLineArg[] = allArgs.map((a) => {
    const reply_count = replyCounts.get(a.id) ?? 0
    const tension_ratio = reply_count / (a.upvotes + 1)
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes ?? 0,
      reply_count,
      ai_grade: a.ai_grade ?? null,
      ai_score: a.ai_score ?? null,
      created_at: a.created_at,
      tension_ratio,
    }
  })

  const totalReplies = enriched.reduce((sum, a) => sum + a.reply_count, 0)
  const avgReplies = enriched.length > 0 ? totalReplies / enriched.length : 0

  // Most contested side
  const blueReplies = enriched.filter((a) => a.side === 'blue').reduce((s, a) => s + a.reply_count, 0)
  const redReplies  = enriched.filter((a) => a.side === 'red').reduce((s, a) => s + a.reply_count, 0)
  const most_contested_side: 'blue' | 'red' | 'equal' =
    blueReplies > redReplies * 1.2 ? 'blue'
    : redReplies > blueReplies * 1.2 ? 'red'
    : 'equal'

  // Flashpoints: most replies (top 5)
  const flashpoints = [...enriched]
    .filter((a) => a.reply_count > 0)
    .sort((a, b) => b.reply_count - a.reply_count)
    .slice(0, 5)

  // Dead certainties: high upvotes, zero replies (top 4)
  const dead_certainties = [...enriched]
    .filter((a) => a.reply_count === 0 && a.upvotes >= 3)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 4)

  // Contested ground: high tension ratio (more replies than upvotes, min 2 replies)
  const contested_ground = [...enriched]
    .filter((a) => a.reply_count >= 2 && a.tension_ratio > 0.5)
    .sort((a, b) => b.tension_ratio - a.tension_ratio)
    .slice(0, 5)

  // First movers: earliest 4 arguments
  const first_movers = [...enriched]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 4)

  return NextResponse.json({
    law_id: law.id,
    topic_id: law.topic_id,
    law_statement: law.statement,
    category: law.category,
    blue_pct: law.blue_pct ?? 50,
    total_votes: law.total_votes ?? 0,
    established_at: law.established_at,
    total_arguments: enriched.length,
    total_replies: totalReplies,
    avg_replies_per_arg: Math.round(avgReplies * 10) / 10,
    most_contested_side,
    flashpoints,
    dead_certainties,
    contested_ground,
    first_movers,
  } satisfies LawFaultLinesData)
}
