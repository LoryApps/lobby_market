import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContestedArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  needs_evidence_count: number
  contest_score: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface ContestedArgumentsResponse {
  for: ContestedArgument[]
  against: ContestedArgument[]
  topCategory: string | null
  generatedAt: string
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

/**
 * GET /api/arguments/contested
 *
 * Returns the most contested arguments on the platform: high upvotes +
 * high reply count + community requests for evidence. Contest score:
 *   upvotes * (1 + reply_count) * (1 + needs_evidence_weight)
 *
 * Query params:
 *   category — filter by topic category (optional)
 *   days     — look-back window in days, 1–90 (default: 30)
 *   limit    — per side, 1–20 (default: 10)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category') ?? ''
  const rawDays = parseInt(searchParams.get('days') ?? '30', 10)
  const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10)

  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : ''
  const days = Math.min(90, Math.max(1, isNaN(rawDays) ? 30 : rawDays))
  const limit = Math.min(20, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit))

  const supabase = await createClient()

  // Fetch candidate arguments from the look-back window with upvotes > 0
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: rawArgs, error } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, ai_score, ai_grade, created_at')
    .gte('created_at', since.toISOString())
    .gt('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(300)

  if (error || !rawArgs?.length) {
    return NextResponse.json(
      { for: [], against: [], topCategory: null, generatedAt: new Date().toISOString() },
      { status: error ? 500 : 200 }
    )
  }

  const argIds = rawArgs.map((a) => a.id)

  // Fetch reply counts per argument
  const { data: replyAgg } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds)

  const replyCountMap = new Map<string, number>()
  for (const r of replyAgg ?? []) {
    replyCountMap.set(r.argument_id, (replyCountMap.get(r.argument_id) ?? 0) + 1)
  }

  // Fetch needs_evidence reaction counts per argument
  const { data: reactionAgg } = await supabase
    .from('argument_reactions')
    .select('argument_id, reaction')
    .in('argument_id', argIds)
    .eq('reaction', 'needs_evidence')

  const evidenceCountMap = new Map<string, number>()
  for (const r of reactionAgg ?? []) {
    evidenceCountMap.set(r.argument_id, (evidenceCountMap.get(r.argument_id) ?? 0) + 1)
  }

  // Compute contest score for each argument
  type ScoredArg = (typeof rawArgs)[0] & {
    reply_count: number
    needs_evidence_count: number
    contest_score: number
  }

  const scored: ScoredArg[] = rawArgs.map((a) => {
    const replies = replyCountMap.get(a.id) ?? 0
    const evidences = evidenceCountMap.get(a.id) ?? 0
    // Score = upvotes × (1 + replies) × (1 + evidence × 0.5)
    const contest_score = a.upvotes * (1 + replies) * (1 + evidences * 0.5)
    return {
      ...a,
      reply_count: replies,
      needs_evidence_count: evidences,
      contest_score,
    }
  })

  // Sort by contest score descending
  scored.sort((a, b) => b.contest_score - a.contest_score)

  // Batch-fetch topics and profiles
  const topicIds = Array.from(new Set(scored.map((a) => a.topic_id)))
  const userIds = Array.from(new Set(scored.map((a) => a.user_id)))

  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  if (category) topicsQuery = topicsQuery.eq('category', category)

  const [topicsRes, profilesRes] = await Promise.all([
    topicsQuery,
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds),
  ])

  const topicMap = new Map((topicsRes.data ?? []).map((t) => [t.id, t]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))

  const enriched: ContestedArgument[] = scored
    .filter((a) => topicMap.has(a.topic_id))
    .map((a) => ({
      id: a.id,
      topic_id: a.topic_id,
      user_id: a.user_id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      reply_count: a.reply_count,
      needs_evidence_count: a.needs_evidence_count,
      contest_score: Math.round(a.contest_score * 100) / 100,
      ai_score: (a as { ai_score?: number | null }).ai_score ?? null,
      ai_grade: (a as { ai_grade?: string | null }).ai_grade ?? null,
      created_at: a.created_at,
      author: profileMap.get(a.user_id) ?? null,
      topic: topicMap.get(a.topic_id) ?? null,
    }))

  const forArgs = enriched.filter((a) => a.side === 'blue').slice(0, limit)
  const againstArgs = enriched.filter((a) => a.side === 'red').slice(0, limit)

  // Compute the most-represented category among top results
  const catCounts = new Map<string, number>()
  for (const a of [...forArgs, ...againstArgs]) {
    const cat = a.topic?.category
    if (cat) catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
  }
  const catEntries = Array.from(catCounts.entries())
  const topCategory =
    catEntries.length > 0
      ? catEntries.sort((a, b) => b[1] - a[1])[0][0]
      : null

  return NextResponse.json({
    for: forArgs,
    against: againstArgs,
    topCategory,
    generatedAt: new Date().toISOString(),
  } satisfies ContestedArgumentsResponse)
}
