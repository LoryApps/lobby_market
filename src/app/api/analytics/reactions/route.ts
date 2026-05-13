import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReactionType = 'insightful' | 'compelling' | 'balanced' | 'needs_evidence'

export interface ReactionBreakdown {
  insightful: number
  compelling: number
  balanced: number
  needs_evidence: number
}

export interface CategoryReception {
  category: string
  argument_count: number
  total_reactions: number
  avg_reactions: number
  breakdown: ReactionBreakdown
  top_type: ReactionType | null
}

export interface SideReception {
  side: 'for' | 'against'
  argument_count: number
  total_reactions: number
  avg_reactions: number
  top_type: ReactionType | null
  reception_score: number
}

export interface TopReactionArgument {
  id: string
  content: string
  upvotes: number
  side: 'blue' | 'red'
  topic_id: string
  topic_statement: string
  topic_category: string | null
  breakdown: ReactionBreakdown
  total_reactions: number
  reception_score: number
}

export interface MonthlyReceptionTrend {
  month: string  // YYYY-MM
  reactions: number
}

export type ReceptionArchetype =
  | 'analyst'       // highest: insightful
  | 'debater'       // highest: compelling
  | 'mediator'      // highest: balanced
  | 'provocateur'   // highest: needs_evidence
  | 'newcomer'      // < 5 total reactions received

export interface ArgumentReceptionData {
  total_received: number
  reaction_breakdown: ReactionBreakdown
  reception_score: number
  archetype: ReceptionArchetype
  top_arguments: TopReactionArgument[]
  category_breakdown: CategoryReception[]
  side_breakdown: SideReception[]
  monthly_trend: MonthlyReceptionTrend[]
  percentile: number | null
  arguments_with_reactions: number
}

const REACTION_WEIGHT: Record<ReactionType, number> = {
  insightful:     3,
  compelling:     2.5,
  balanced:       2,
  needs_evidence: 0.5,
}

function computeScore(breakdown: ReactionBreakdown): number {
  return (
    breakdown.insightful     * REACTION_WEIGHT.insightful +
    breakdown.compelling     * REACTION_WEIGHT.compelling +
    breakdown.balanced       * REACTION_WEIGHT.balanced +
    breakdown.needs_evidence * REACTION_WEIGHT.needs_evidence
  )
}

function topType(breakdown: ReactionBreakdown): ReactionType | null {
  const entries = Object.entries(breakdown) as [ReactionType, number][]
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0])
  return best[1] > 0 ? best[0] : null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: myArgs, error: argsError } = await supabase
    .from('topic_arguments')
    .select('id, side, topic_id, upvotes, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (argsError) {
    return NextResponse.json({ error: argsError.message }, { status: 500 })
  }

  const args = myArgs ?? []
  const argIds = args.map((a) => a.id)

  if (argIds.length === 0) {
    return NextResponse.json({
      total_received: 0,
      reaction_breakdown: { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 },
      reception_score: 0,
      archetype: 'newcomer',
      top_arguments: [],
      category_breakdown: [],
      side_breakdown: [],
      monthly_trend: [],
      percentile: null,
      arguments_with_reactions: 0,
    } satisfies ArgumentReceptionData)
  }

  const { data: reactions, error: reactionsError } = await supabase
    .from('argument_reactions')
    .select('argument_id, reaction, created_at')
    .in('argument_id', argIds)

  if (reactionsError) {
    return NextResponse.json({ error: reactionsError.message }, { status: 500 })
  }

  const allReactions = reactions ?? []

  if (allReactions.length === 0) {
    return NextResponse.json({
      total_received: 0,
      reaction_breakdown: { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 },
      reception_score: 0,
      archetype: 'newcomer',
      top_arguments: [],
      category_breakdown: [],
      side_breakdown: [],
      monthly_trend: [],
      percentile: null,
      arguments_with_reactions: 0,
    } satisfies ArgumentReceptionData)
  }

  const topicIds = [...new Set(args.map((a) => a.topic_id))]
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category')
    .in('id', topicIds)

  const topicById: Record<string, { statement: string; category: string | null }> = {}
  for (const t of topicRows ?? []) {
    topicById[t.id] = { statement: t.statement, category: t.category }
  }

  const argBreakdown: Record<string, ReactionBreakdown> = {}
  for (const r of allReactions) {
    if (!argBreakdown[r.argument_id]) {
      argBreakdown[r.argument_id] = { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 }
    }
    const type = r.reaction as ReactionType
    if (type in argBreakdown[r.argument_id]) {
      argBreakdown[r.argument_id][type]++
    }
  }

  const totalBreakdown: ReactionBreakdown = { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 }
  for (const bd of Object.values(argBreakdown)) {
    totalBreakdown.insightful     += bd.insightful
    totalBreakdown.compelling     += bd.compelling
    totalBreakdown.balanced       += bd.balanced
    totalBreakdown.needs_evidence += bd.needs_evidence
  }
  const totalReceived = allReactions.length
  const receptionScore = computeScore(totalBreakdown)

  let archetype: ReceptionArchetype
  if (totalReceived < 5) {
    archetype = 'newcomer'
  } else {
    const top = topType(totalBreakdown)
    if (top === 'insightful')     archetype = 'analyst'
    else if (top === 'compelling') archetype = 'debater'
    else if (top === 'balanced')   archetype = 'mediator'
    else                           archetype = 'provocateur'
  }

  const argsWithReactions = args.filter((a) => argBreakdown[a.id])
  const topArguments: TopReactionArgument[] = argsWithReactions
    .map((a) => {
      const bd = argBreakdown[a.id] ?? { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 }
      const total = bd.insightful + bd.compelling + bd.balanced + bd.needs_evidence
      const topic = topicById[a.topic_id]
      return {
        id: a.id,
        content: a.content.slice(0, 280),
        upvotes: a.upvotes ?? 0,
        side: a.side as 'blue' | 'red',
        topic_id: a.topic_id,
        topic_statement: topic?.statement ?? '',
        topic_category: topic?.category ?? null,
        breakdown: bd,
        total_reactions: total,
        reception_score: computeScore(bd),
      }
    })
    .sort((a, b) => b.reception_score - a.reception_score)
    .slice(0, 10)

  const catMap: Record<string, { arg_count: number; total: number; bd: ReactionBreakdown }> = {}
  for (const a of argsWithReactions) {
    const cat = topicById[a.topic_id]?.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { arg_count: 0, total: 0, bd: { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 } }
    const bd = argBreakdown[a.id]
    catMap[cat].arg_count++
    const argTotal = bd.insightful + bd.compelling + bd.balanced + bd.needs_evidence
    catMap[cat].total += argTotal
    catMap[cat].bd.insightful     += bd.insightful
    catMap[cat].bd.compelling     += bd.compelling
    catMap[cat].bd.balanced       += bd.balanced
    catMap[cat].bd.needs_evidence += bd.needs_evidence
  }

  const categoryBreakdown: CategoryReception[] = Object.entries(catMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 8)
    .map(([category, { arg_count, total, bd }]) => ({
      category,
      argument_count: arg_count,
      total_reactions: total,
      avg_reactions: arg_count > 0 ? Math.round((total / arg_count) * 10) / 10 : 0,
      breakdown: bd,
      top_type: topType(bd),
    }))

  const sideMap: Record<'blue' | 'red', { count: number; total: number; bd: ReactionBreakdown }> = {
    blue: { count: 0, total: 0, bd: { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 } },
    red:  { count: 0, total: 0, bd: { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 } },
  }

  for (const a of argsWithReactions) {
    const side = a.side as 'blue' | 'red'
    const bd = argBreakdown[a.id]
    const argTotal = bd.insightful + bd.compelling + bd.balanced + bd.needs_evidence
    sideMap[side].count++
    sideMap[side].total += argTotal
    sideMap[side].bd.insightful     += bd.insightful
    sideMap[side].bd.compelling     += bd.compelling
    sideMap[side].bd.balanced       += bd.balanced
    sideMap[side].bd.needs_evidence += bd.needs_evidence
  }

  const sideBreakdown: SideReception[] = (['blue', 'red'] as const).map((side) => {
    const { count, total, bd } = sideMap[side]
    return {
      side: side === 'blue' ? 'for' : 'against',
      argument_count: count,
      total_reactions: total,
      avg_reactions: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
      top_type: topType(bd),
      reception_score: computeScore(bd),
    }
  })

  const now = new Date()
  const months: MonthlyReceptionTrend[] = []
  const monthMap: Record<string, number> = {}

  for (const r of allReactions) {
    const m = r.created_at.slice(0, 7)
    monthMap[m] = (monthMap[m] ?? 0) + 1
  }

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ month: key, reactions: monthMap[key] ?? 0 })
  }

  const percentile =
    totalReceived > 0
      ? Math.min(99, Math.round(50 + (Math.log(totalReceived + 1) / Math.log(100)) * 49))
      : null

  return NextResponse.json({
    total_received: totalReceived,
    reaction_breakdown: totalBreakdown,
    reception_score: Math.round(receptionScore * 10) / 10,
    archetype,
    top_arguments: topArguments,
    category_breakdown: categoryBreakdown,
    side_breakdown: sideBreakdown,
    monthly_trend: months,
    percentile,
    arguments_with_reactions: argsWithReactions.length,
  } satisfies ArgumentReceptionData)
}
