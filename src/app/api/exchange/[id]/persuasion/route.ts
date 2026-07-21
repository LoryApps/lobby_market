import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersuasionArgument {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  reply_count: number
  persuasion_score: number
  rhetorical_style: 'evidence' | 'logical' | 'narrative' | 'emotional'
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
  for_arguments: number
  against_arguments: number
  avg_persuasion_score: number
  top_rhetorical_style: string
  cross_aisle_count: number
  citation_rate: number
  for_avg_length: number
  against_avg_length: number
  for_avg_score: number
  against_avg_score: number
}

export interface ExchangePersuasionResponse {
  market: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    volume: number
  }
  top_persuaders: PersuasionArgument[]
  cross_aisle_breakers: PersuasionArgument[]
  overlooked_gems: PersuasionArgument[]
  style_breakdown: {
    style: string
    count: number
    avg_score: number
    for_pct: number
  }[]
  stats: PersuasionStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectRhetoricalStyle(content: string): PersuasionArgument['rhetorical_style'] {
  if (
    /\d+%|\bstudy\b|\bdata\b|\bsource\b|\baccording\b|\bresearch\b|\bstatistic|\bevidence\b|\bsurvey\b|\breport\b/i.test(content)
  ) return 'evidence'

  if (
    /\btherefore\b|\bconsequently\b|\bthus\b|\bhence\b|\bbecause\b|\bif\b.*\bthen\b|\bimplies\b|\bfollows\b|\blogically\b/i.test(content)
    || content.split(/\s+/).length > 80
  ) return 'logical'

  if (
    /\bi (experienced|witnessed|saw|lived|grew up|remember|was|worked)\b|\bimagine\b|\bstory\b|\bpeople like\b|\bfamilies\b/i.test(content)
  ) return 'narrative'

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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Market (topic) ─────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  const price = Math.round(topic.blue_pct ?? 50)
  const volume = topic.total_votes ?? 0

  // ── 2. Arguments ──────────────────────────────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(`
      id, content, side,
      upvote_count, reply_count,
      created_at,
      author:profiles!arguments_author_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `)
    .eq('topic_id', id)
    .order('upvote_count', { ascending: false })
    .limit(80)

  const args = rawArgs ?? []

  // ── 3. Vote data for cross-aisle detection ────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, side')
    .eq('topic_id', id)

  const voteMap = new Map<string, string>()
  for (const v of votes ?? []) {
    if (v.user_id) voteMap.set(String(v.user_id), String(v.side))
  }

  // ── 4. Reply authors for cross-aisle scoring ──────────────────────────────
  const argIds = args.map((a) => a.id)
  const replyMap = new Map<string, string[]>()

  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('parent_id, author_id')
      .in('parent_id', argIds)

    for (const r of replies ?? []) {
      if (!r.parent_id || !r.author_id) continue
      const pid = String(r.parent_id)
      const arr = replyMap.get(pid) ?? []
      arr.push(String(r.author_id))
      replyMap.set(pid, arr)
    }
  }

  // ── 5. Enrich arguments ───────────────────────────────────────────────────
  const enriched: PersuasionArgument[] = args.map((a) => {
    const argSide = a.side === 'blue' ? 'for' : 'against'
    const upvotes = a.upvote_count ?? 0
    const reply_count = a.reply_count ?? 0
    const words = (a.content ?? '').split(/\s+/).length

    // Cross-aisle replies: people who voted the other side
    const replyAuthors = replyMap.get(a.id) ?? []
    const oppositeSide = argSide === 'for' ? 'red' : 'blue'
    const cross_aisle_replies = replyAuthors.filter(
      (uid) => voteMap.get(uid) === oppositeSide
    ).length

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

  const top_persuaders = [...enriched]
    .sort((a, b) => b.persuasion_score - a.persuasion_score)
    .slice(0, 8)

  const cross_aisle_breakers = [...enriched]
    .filter((a) => a.cross_aisle_replies > 0)
    .sort((a, b) => b.cross_aisle_replies - a.cross_aisle_replies || b.upvotes - a.upvotes)
    .slice(0, 5)

  const avgUpvotes = enriched.reduce((s, a) => s + a.upvotes, 0) / Math.max(enriched.length, 1)
  const overlooked_gems = [...enriched]
    .filter((a) => a.upvotes >= Math.max(avgUpvotes, 3) && a.reply_count === 0)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 4)

  const STYLES = ['evidence', 'logical', 'narrative', 'emotional'] as const
  const style_breakdown = STYLES.map((style) => {
    const group = enriched.filter((a) => a.rhetorical_style === style)
    const forCount = group.filter((a) => a.side === 'for').length
    return {
      style,
      count: group.length,
      avg_score: group.length
        ? Math.round(group.reduce((s, a) => s + a.persuasion_score, 0) / group.length)
        : 0,
      for_pct: group.length ? Math.round((forCount / group.length) * 100) : 50,
    }
  }).sort((a, b) => b.avg_score - a.avg_score)

  const forArgs = enriched.filter((a) => a.side === 'for')
  const againstArgs = enriched.filter((a) => a.side === 'against')
  const citationArgs = enriched.filter((a) => a.has_citation)
  const crossArgs = enriched.filter((a) => a.cross_aisle_replies > 0)
  const avgScore = enriched.reduce((s, a) => s + a.persuasion_score, 0) / Math.max(enriched.length, 1)

  const stats: PersuasionStats = {
    total_arguments: enriched.length,
    for_arguments: forArgs.length,
    against_arguments: againstArgs.length,
    avg_persuasion_score: Math.round(avgScore),
    top_rhetorical_style: style_breakdown[0]?.style ?? 'logical',
    cross_aisle_count: crossArgs.length,
    citation_rate: enriched.length ? Math.round((citationArgs.length / enriched.length) * 100) : 0,
    for_avg_length: forArgs.length
      ? Math.round(forArgs.reduce((s, a) => s + a.word_count, 0) / forArgs.length)
      : 0,
    against_avg_length: againstArgs.length
      ? Math.round(againstArgs.reduce((s, a) => s + a.word_count, 0) / againstArgs.length)
      : 0,
    for_avg_score: forArgs.length
      ? Math.round(forArgs.reduce((s, a) => s + a.persuasion_score, 0) / forArgs.length)
      : 0,
    against_avg_score: againstArgs.length
      ? Math.round(againstArgs.reduce((s, a) => s + a.persuasion_score, 0) / againstArgs.length)
      : 0,
  }

  return NextResponse.json({
    market: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price,
      volume,
    },
    top_persuaders,
    cross_aisle_breakers,
    overlooked_gems,
    style_breakdown,
    stats,
  } satisfies ExchangePersuasionResponse)
}
