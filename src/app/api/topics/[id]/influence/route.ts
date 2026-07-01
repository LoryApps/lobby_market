import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InfluenceArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  influence_score: number
  upvote_velocity: number
  tier: 'titan' | 'catalyst' | 'ripple'
  rank: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface InfluenceStats {
  total_arguments: number
  for_influence_score: number
  against_influence_score: number
  for_arguments: number
  against_arguments: number
  avg_influence_score: number
  titan_count: number
  catalyst_count: number
  dominant_side: 'for' | 'against' | 'balanced'
  influence_gap: number
}

export interface InfluenceResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  arguments: InfluenceArgument[]
  stats: InfluenceStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coerceAuthor(raw: unknown): InfluenceArgument['author'] {
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

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch arguments with aliased author join
  const { data: rawArgs, error: argsErr } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      ai_score,
      ai_grade,
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
    .limit(50)

  if (argsErr) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  // Fetch reply counts per argument in one batch
  const argIds = args.map((a) => a.id)
  const replyCounts: Record<string, number> = {}

  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)

    if (replies) {
      for (const r of replies) {
        replyCounts[r.argument_id] = (replyCounts[r.argument_id] ?? 0) + 1
      }
    }
  }

  // Compute influence scores
  const now = Date.now()
  const scored: InfluenceArgument[] = args.map((arg) => {
    const replyCount = replyCounts[arg.id] ?? 0
    const ageMs = now - new Date(arg.created_at).getTime()
    const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 0.01)
    const upvoteVelocity = arg.upvotes / ageDays

    // Influence = upvotes carry most weight; replies signal discussion power;
    // AI score adds quality signal; velocity rewards recent traction.
    const aiBonus = arg.ai_score ? (arg.ai_score as number) * 2 : 0
    const influenceScore = Math.round(
      (arg.upvotes ?? 0) * 3 +
      replyCount * 2 +
      aiBonus +
      Math.min(upvoteVelocity * 0.5, 20) // velocity capped at +20
    )

    return {
      id: arg.id,
      content: arg.content,
      side: arg.side as 'blue' | 'red',
      upvotes: arg.upvotes ?? 0,
      reply_count: replyCount,
      ai_score: arg.ai_score ? (arg.ai_score as number) : null,
      ai_grade: arg.ai_grade ? (arg.ai_grade as string) : null,
      created_at: arg.created_at,
      influence_score: influenceScore,
      upvote_velocity: Math.round(upvoteVelocity * 10) / 10,
      tier: 'ripple' as const,
      rank: 0,
      author: coerceAuthor(arg.author),
    }
  })

  // Sort by influence score descending
  scored.sort((a, b) => b.influence_score - a.influence_score)

  // Assign tiers and ranks
  const result: InfluenceArgument[] = scored.map((arg, i) => ({
    ...arg,
    rank: i + 1,
    tier: (i < 3 ? 'titan' : i < 10 ? 'catalyst' : 'ripple') as InfluenceArgument['tier'],
  }))

  // Compute aggregate stats
  const forArgs = result.filter((a) => a.side === 'blue')
  const againstArgs = result.filter((a) => a.side === 'red')

  const forScore = forArgs.reduce((s, a) => s + a.influence_score, 0)
  const againstScore = againstArgs.reduce((s, a) => s + a.influence_score, 0)
  const totalScore = forScore + againstScore

  const influenceGap =
    totalScore > 0
      ? Math.round((Math.abs(forScore - againstScore) / totalScore) * 100)
      : 0

  const dominantSide: InfluenceStats['dominant_side'] =
    influenceGap < 10
      ? 'balanced'
      : forScore > againstScore
      ? 'for'
      : 'against'

  const avgScore =
    result.length > 0
      ? Math.round(result.reduce((s, a) => s + a.influence_score, 0) / result.length)
      : 0

  const stats: InfluenceStats = {
    total_arguments: result.length,
    for_influence_score: forScore,
    against_influence_score: againstScore,
    for_arguments: forArgs.length,
    against_arguments: againstArgs.length,
    avg_influence_score: avgScore,
    titan_count: result.filter((a) => a.tier === 'titan').length,
    catalyst_count: result.filter((a) => a.tier === 'catalyst').length,
    dominant_side: dominantSide,
    influence_gap: influenceGap,
  }

  const response: InfluenceResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    arguments: result,
    stats,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  })
}
