import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImpactArchetype =
  | 'catalyst'
  | 'specialist'
  | 'connector'
  | 'rising_voice'
  | 'silent_force'
  | 'wide_net'

export interface ImpactArgument {
  id: string
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  impact_score: number
  topic_status: string
  topic_blue_pct: number
  created_at: string
}

export interface ImpactCategoryStat {
  category: string
  arguments: number
  upvotes: number
  replies: number
  avg_upvotes: number
  reach: number
}

export interface ImpactMonthly {
  month: string
  arguments: number
  upvotes: number
  replies: number
}

export interface ImpactResponse {
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  total_arguments: number
  total_upvotes: number
  total_replies: number
  total_reach: number
  debate_wins: number
  debate_total: number
  win_rate: number | null
  impact_score: number
  archetype: ImpactArchetype
  archetype_label: string
  archetype_description: string
  top_arguments: ImpactArgument[]
  category_stats: ImpactCategoryStat[]
  monthly: ImpactMonthly[]
  best_category: string | null
  best_upvoted_side: 'blue' | 'red' | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyArchetype(
  totalUpvotes: number,
  totalReplies: number,
  totalArguments: number,
  totalReach: number,
  categoryStats: ImpactCategoryStat[],
): ImpactArchetype {
  if (totalArguments === 0) return 'rising_voice'

  const avgUpvotes = totalUpvotes / totalArguments
  const activeCats = categoryStats.filter((c) => c.arguments >= 2).length
  const replyRatio = totalArguments > 0 ? totalReplies / totalArguments : 0
  const upvoteRatio = totalArguments > 0 ? totalUpvotes / totalArguments : 0

  // High upvotes, spread across many categories → Catalyst
  if (avgUpvotes >= 5 && activeCats >= 4) return 'catalyst'
  // High quality in few categories → Specialist
  if (avgUpvotes >= 4 && activeCats <= 2) return 'specialist'
  // High reply ratio (sparks conversation) → Connector
  if (replyRatio >= 2 && totalReplies >= 10) return 'connector'
  // High reach (argues in popular topics) but modest upvotes → Silent Force
  if (totalReach >= 500 && upvoteRatio < 2) return 'silent_force'
  // Broad spread, moderate performance → Wide Net
  if (activeCats >= 5) return 'wide_net'
  // Default: still building momentum
  return 'rising_voice'
}

const ARCHETYPE_META: Record<
  ImpactArchetype,
  { label: string; description: string }
> = {
  catalyst: {
    label: 'The Catalyst',
    description:
      'Your arguments ignite debate across every corner of the Lobby. High quality, broad reach — you move the needle wherever you show up.',
  },
  specialist: {
    label: 'The Specialist',
    description:
      'You go deep in a few key categories, delivering consistently high-quality arguments that earn strong recognition from those who know the domain.',
  },
  connector: {
    label: 'The Connector',
    description:
      "Your arguments spark conversations. You don't just state a position — you open a thread that draws in dozens of other voices.",
  },
  silent_force: {
    label: 'The Silent Force',
    description:
      "You argue in the biggest debates on the platform. Your reach is massive, and your presence shapes outcomes even when the upvotes don't capture your full influence.",
  },
  wide_net: {
    label: 'The Wide Net',
    description:
      'You engage across every category the Lobby covers. Breadth is your signature — no debate goes untouched by your perspective.',
  },
  rising_voice: {
    label: 'The Rising Voice',
    description:
      "You're building your civic reputation, argument by argument. Keep engaging — the platform rewards consistency and quality over time.",
  },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Profile ──────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── 2. All user arguments with topic context ────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      topic_id,
      side,
      content,
      upvotes,
      created_at,
      topics!inner (
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  const args = (rawArgs ?? []) as Array<{
    id: string
    topic_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    topics: {
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    }
  }>

  if (args.length === 0) {
    return NextResponse.json({
      user: profile,
      total_arguments: 0,
      total_upvotes: 0,
      total_replies: 0,
      total_reach: 0,
      debate_wins: 0,
      debate_total: 0,
      win_rate: null,
      impact_score: 0,
      archetype: 'rising_voice' as ImpactArchetype,
      archetype_label: ARCHETYPE_META.rising_voice.label,
      archetype_description: ARCHETYPE_META.rising_voice.description,
      top_arguments: [],
      category_stats: [],
      monthly: [],
      best_category: null,
      best_upvoted_side: null,
    } satisfies ImpactResponse)
  }

  // ── 3. Reply counts per argument ────────────────────────────────────────────
  const argIds = args.map((a) => a.id)

  const { data: replyRows } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds)

  const replyCount: Record<string, number> = {}
  for (const r of replyRows ?? []) {
    replyCount[r.argument_id] = (replyCount[r.argument_id] ?? 0) + 1
  }

  // ── 4. Aggregate totals ─────────────────────────────────────────────────────
  const totalUpvotes = args.reduce((s, a) => s + a.upvotes, 0)
  const totalReplies = Object.values(replyCount).reduce((s, v) => s + v, 0)
  const totalReach = args.reduce((s, a) => s + (a.topics.total_votes ?? 0), 0)

  // ── 5. Debate wins: topics where user's side won (for resolved topics) ───────
  const resolvedArgs = args.filter(
    (a) => a.topics.status === 'law' || a.topics.status === 'failed',
  )
  const debateWins = resolvedArgs.filter((a) => {
    if (a.topics.status === 'law') return a.side === 'blue'
    if (a.topics.status === 'failed') return a.side === 'red'
    return false
  }).length

  // ── 6. Impact score: weighted composite ─────────────────────────────────────
  // upvotes × 3 + replies × 2 + log(reach) + wins × 5
  const impactScore = Math.round(
    totalUpvotes * 3 +
      totalReplies * 2 +
      (totalReach > 0 ? Math.log10(totalReach) * 10 : 0) +
      debateWins * 5,
  )

  // ── 7. Enrich arguments with reply counts + impact_score ────────────────────
  const enriched: ImpactArgument[] = args.map((a) => {
    const replies = replyCount[a.id] ?? 0
    return {
      id: a.id,
      topic_id: a.topic_id,
      statement: a.topics.statement,
      category: a.topics.category,
      side: a.side,
      content: a.content,
      upvotes: a.upvotes,
      reply_count: replies,
      impact_score: a.upvotes * 3 + replies * 2,
      topic_status: a.topics.status,
      topic_blue_pct: a.topics.blue_pct,
      created_at: a.created_at,
    }
  })

  const topArguments = [...enriched]
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, 6)

  // ── 8. Category stats ───────────────────────────────────────────────────────
  const catMap = new Map<
    string,
    { arguments: number; upvotes: number; replies: number; reach: number }
  >()
  for (const a of enriched) {
    const cat = a.category ?? 'Other'
    const cur = catMap.get(cat) ?? { arguments: 0, upvotes: 0, replies: 0, reach: 0 }
    catMap.set(cat, {
      arguments: cur.arguments + 1,
      upvotes: cur.upvotes + a.upvotes,
      replies: cur.replies + a.reply_count,
      reach: cur.reach, // accumulate reach separately
    })
  }
  // Add reach from raw args
  for (const a of args) {
    const cat = a.topics.category ?? 'Other'
    const cur = catMap.get(cat)!
    catMap.set(cat, { ...cur, reach: cur.reach + (a.topics.total_votes ?? 0) })
  }

  const categoryStats: ImpactCategoryStat[] = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      arguments: s.arguments,
      upvotes: s.upvotes,
      replies: s.replies,
      avg_upvotes: s.arguments > 0 ? Math.round((s.upvotes / s.arguments) * 10) / 10 : 0,
      reach: s.reach,
    }))
    .sort((a, b) => b.upvotes - a.upvotes)

  const bestCategory = categoryStats[0]?.category ?? null

  // ── 9. Monthly breakdown ────────────────────────────────────────────────────
  const monthMap = new Map<
    string,
    { arguments: number; upvotes: number; replies: number }
  >()
  for (const a of enriched) {
    const key = a.created_at.slice(0, 7)
    const cur = monthMap.get(key) ?? { arguments: 0, upvotes: 0, replies: 0 }
    monthMap.set(key, {
      arguments: cur.arguments + 1,
      upvotes: cur.upvotes + a.upvotes,
      replies: cur.replies + a.reply_count,
    })
  }
  const monthly: ImpactMonthly[] = Array.from(monthMap.entries())
    .map(([month, s]) => ({ month, ...s }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)

  // ── 10. Best upvoted side ───────────────────────────────────────────────────
  const blueUpvotes = enriched.filter((a) => a.side === 'blue').reduce((s, a) => s + a.upvotes, 0)
  const redUpvotes = enriched.filter((a) => a.side === 'red').reduce((s, a) => s + a.upvotes, 0)
  const bestUpvotedSide: 'blue' | 'red' | null =
    blueUpvotes === 0 && redUpvotes === 0
      ? null
      : blueUpvotes >= redUpvotes
        ? 'blue'
        : 'red'

  // ── 11. Archetype ───────────────────────────────────────────────────────────
  const archetype = classifyArchetype(
    totalUpvotes,
    totalReplies,
    args.length,
    totalReach,
    categoryStats,
  )

  const result: ImpactResponse = {
    user: profile,
    total_arguments: args.length,
    total_upvotes: totalUpvotes,
    total_replies: totalReplies,
    total_reach: totalReach,
    debate_wins: debateWins,
    debate_total: resolvedArgs.length,
    win_rate:
      resolvedArgs.length > 0
        ? Math.round((debateWins / resolvedArgs.length) * 100)
        : null,
    impact_score: impactScore,
    archetype,
    archetype_label: ARCHETYPE_META[archetype].label,
    archetype_description: ARCHETYPE_META[archetype].description,
    top_arguments: topArguments,
    category_stats: categoryStats,
    monthly,
    best_category: bestCategory,
    best_upvoted_side: bestUpvotedSide,
  }

  return NextResponse.json(result)
}
