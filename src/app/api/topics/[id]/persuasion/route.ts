import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersuasionArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  persuasion_score: number
  rhetorical_style: 'evidence' | 'narrative' | 'logical' | 'emotional'
  word_count: number
  has_citation: boolean
  cross_aisle_replies: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface PersuasionStats {
  total_arguments: number
  blue_arguments: number
  red_arguments: number
  avg_persuasion_score: number
  top_rhetorical_style: string
  cross_aisle_count: number
  citation_rate: number
  blue_avg_length: number
  red_avg_length: number
  blue_avg_score: number
  red_avg_score: number
}

export interface PersuasionResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  top_persuaders: PersuasionArgument[]
  cross_aisle_breakers: PersuasionArgument[]
  overlooked_gems: PersuasionArgument[]
  style_breakdown: {
    style: string
    count: number
    avg_score: number
    blue_pct: number
  }[]
  stats: PersuasionStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectRhetoricalStyle(content: string): PersuasionArgument['rhetorical_style'] {
  const words = content.split(/\s+/).length

  // Evidence: citations, stats, studies, data
  if (
    /\d+%|\bstudy\b|\bdata\b|\bsource\b|\baccording\b|\bresearch\b|\bstatistic|\bevidence\b|\bsurvey\b|\breport\b/i.test(content)
  ) return 'evidence'

  // Logical: "therefore", "because", "if...then", "conclusion", structured
  if (
    /\btherefore\b|\bconsequently\b|\bthus\b|\bhence\b|\bbecause\b|\bif\b.*\bthen\b|\bimplies\b|\bfollows\b|\blogically\b/i.test(content) ||
    words > 80
  ) return 'logical'

  // Narrative: personal stories, "I", "we experienced", "imagine"
  if (
    /\bi (experienced|witnessed|saw|lived|grew up|remember|was|worked)\b|\bimagine\b|\bstory\b|\bpeople like\b|\bfamilies\b/i.test(content)
  ) return 'narrative'

  // Emotional: strong value language, urgency
  return 'emotional'
}

function coerceAuthor(raw: unknown): PersuasionArgument['author'] {
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

// GET /api/topics/[id]/persuasion
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
      .limit(200),
  ])

  if (!topicResult.data) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic = topicResult.data
  const args = argsResult.data ?? []

  const empty: PersuasionResponse = {
    topic,
    top_persuaders: [],
    cross_aisle_breakers: [],
    overlooked_gems: [],
    style_breakdown: [],
    stats: {
      total_arguments: 0,
      blue_arguments: 0,
      red_arguments: 0,
      avg_persuasion_score: 0,
      top_rhetorical_style: 'logical',
      cross_aisle_count: 0,
      citation_rate: 0,
      blue_avg_length: 0,
      red_avg_length: 0,
      blue_avg_score: 0,
      red_avg_score: 0,
    },
  }

  if (args.length === 0) {
    return NextResponse.json(empty)
  }

  const argIds = args.map((a) => a.id)

  // Fetch replies to compute reply counts and cross-aisle signals
  const { data: allReplies } = await supabase
    .from('argument_replies')
    .select('id, argument_id, user_id')
    .in('argument_id', argIds)
    .eq('topic_id', params.id)

  const replies = allReplies ?? []

  // Build reply map
  const replyMap = new Map<string, string[]>() // argumentId -> userIds of repliers
  for (const r of replies) {
    const list = replyMap.get(r.argument_id) ?? []
    list.push(r.user_id)
    replyMap.set(r.argument_id, list)
  }

  // Fetch votes to determine which side each replier voted on
  // (used to compute cross-aisle replies)
  const replierIds = [...new Set(replies.map((r) => r.user_id))]
  const voteMap = new Map<string, 'blue' | 'red'>() // userId -> their vote

  if (replierIds.length > 0) {
    const { data: votes } = await supabase
      .from('votes')
      .select('user_id, side')
      .eq('topic_id', params.id)
      .in('user_id', replierIds.slice(0, 500))

    for (const v of votes ?? []) {
      voteMap.set(v.user_id, v.side as 'blue' | 'red')
    }
  }

  // Enrich arguments
  type RawArg = (typeof args)[number]
  const enriched: PersuasionArgument[] = args.map((a: RawArg) => {
    const argReplierIds = replyMap.get(a.id) ?? []
    const reply_count = argReplierIds.length
    const argSide = a.side as 'blue' | 'red'
    const oppositeSide = argSide === 'blue' ? 'red' : 'blue'

    // Count cross-aisle replies (repliers who voted for the opposite side)
    const cross_aisle_replies = argReplierIds.filter(
      (uid) => voteMap.get(uid) === oppositeSide
    ).length

    const upvotes = a.upvotes ?? 0
    const words = (a.content ?? '').split(/\s+/).length

    // Persuasion score: upvotes are primary signal
    // Cross-aisle engagement is a strong signal of genuine persuasion
    // Reply engagement shows the argument sparked discussion
    const persuasion_score =
      upvotes * 3 +
      cross_aisle_replies * 8 +
      reply_count * 2

    const has_citation =
      /\d+%|\bstudy\b|\bsource\b|\bdata\b|\baccording\b|\bresearch\b|\bstatistic/i.test(a.content ?? '')

    return {
      id: a.id,
      content: a.content ?? '',
      side: argSide,
      upvotes,
      reply_count,
      persuasion_score,
      rhetorical_style: detectRhetoricalStyle(a.content ?? ''),
      word_count: words,
      has_citation,
      cross_aisle_replies,
      created_at: a.created_at,
      author: coerceAuthor(a.author),
    }
  })

  // Top 8 most persuasive overall
  const top_persuaders = [...enriched]
    .sort((a, b) => b.persuasion_score - a.persuasion_score)
    .slice(0, 8)

  // Cross-aisle breakers: arguments that received replies from opposing voters
  const cross_aisle_breakers = [...enriched]
    .filter((a) => a.cross_aisle_replies > 0)
    .sort((a, b) => b.cross_aisle_replies - a.cross_aisle_replies || b.upvotes - a.upvotes)
    .slice(0, 5)

  // Overlooked gems: high upvotes but LOW reply count (silently persuasive)
  const avgUpvotes = enriched.reduce((s, a) => s + a.upvotes, 0) / Math.max(enriched.length, 1)
  const overlooked_gems = [...enriched]
    .filter((a) => a.upvotes >= Math.max(avgUpvotes, 3) && a.reply_count === 0)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 4)

  // Style breakdown
  const STYLES = ['evidence', 'logical', 'narrative', 'emotional'] as const
  const style_breakdown = STYLES.map((style) => {
    const group = enriched.filter((a) => a.rhetorical_style === style)
    const blueCount = group.filter((a) => a.side === 'blue').length
    return {
      style,
      count: group.length,
      avg_score: group.length
        ? Math.round(group.reduce((s, a) => s + a.persuasion_score, 0) / group.length)
        : 0,
      blue_pct: group.length ? Math.round((blueCount / group.length) * 100) : 50,
    }
  }).sort((a, b) => b.avg_score - a.avg_score)

  // Stats
  const blueArgs = enriched.filter((a) => a.side === 'blue')
  const redArgs = enriched.filter((a) => a.side === 'red')
  const citationArgs = enriched.filter((a) => a.has_citation)
  const crossArgs = enriched.filter((a) => a.cross_aisle_replies > 0)

  const avgScore = enriched.reduce((s, a) => s + a.persuasion_score, 0) / Math.max(enriched.length, 1)
  const topStyle = style_breakdown[0]?.style ?? 'logical'

  const stats: PersuasionStats = {
    total_arguments: enriched.length,
    blue_arguments: blueArgs.length,
    red_arguments: redArgs.length,
    avg_persuasion_score: Math.round(avgScore),
    top_rhetorical_style: topStyle,
    cross_aisle_count: crossArgs.length,
    citation_rate: enriched.length ? Math.round((citationArgs.length / enriched.length) * 100) : 0,
    blue_avg_length: blueArgs.length
      ? Math.round(blueArgs.reduce((s, a) => s + a.word_count, 0) / blueArgs.length)
      : 0,
    red_avg_length: redArgs.length
      ? Math.round(redArgs.reduce((s, a) => s + a.word_count, 0) / redArgs.length)
      : 0,
    blue_avg_score: blueArgs.length
      ? Math.round(blueArgs.reduce((s, a) => s + a.persuasion_score, 0) / blueArgs.length)
      : 0,
    red_avg_score: redArgs.length
      ? Math.round(redArgs.reduce((s, a) => s + a.persuasion_score, 0) / redArgs.length)
      : 0,
  }

  return NextResponse.json({
    topic,
    top_persuaders,
    cross_aisle_breakers,
    overlooked_gems,
    style_breakdown,
    stats,
  } satisfies PersuasionResponse)
}
