import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 90

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VortexTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  /** Top-level arguments posted */
  argument_count: number
  /** Unique users who argued */
  unique_arguers: number
  /** Reply count across all arguments on this topic */
  reply_count: number
  /** Number of debates held */
  debate_count: number
  /**
   * Vortex Score = (arg_count × 12 + unique_arguers × 8 + reply_count × 3)
   *                / log2(total_votes + 2)
   *
   * Numerator rewards argument volume AND diversity of voices AND reply depth.
   * Denominator log-scales votes so fierce-but-small topics still surface.
   */
  vortex_score: number
  /** (args + replies) per vote — raw density ratio */
  arg_density: number
  created_at: string
  top_argument: VortexArgument | null
}

export interface VortexArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface VortexStats {
  total_qualified: number
  avg_vortex_score: number
  highest_density_category: string | null
  total_arguments_in_vortex: number
}

export interface VortexResponse {
  topics: VortexTopic[]
  stats: VortexStats
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_VOTES = 5
const MIN_ARGS = 3
const MAX_RESULTS = 60
const DEFAULT_LIMIT = 25

// ─── GET /api/vortex ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') ?? null
  const sort = (searchParams.get('sort') ?? 'vortex') as 'vortex' | 'density' | 'arguers' | 'replies'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10), MAX_RESULTS)

  const supabase = await createClient()

  // Fetch topics with enough votes
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_VOTES)
    .order('total_votes', { ascending: false })
    .limit(MAX_RESULTS)

  if (category) topicsQuery = topicsQuery.eq('category', category)

  const { data: topicsRaw, error } = await topicsQuery
  if (error || !topicsRaw?.length) {
    return NextResponse.json({
      topics: [],
      stats: { total_qualified: 0, avg_vortex_score: 0, highest_density_category: null, total_arguments_in_vortex: 0 },
      generated_at: new Date().toISOString(),
    } satisfies VortexResponse)
  }

  const topicIds = topicsRaw.map((t) => t.id)

  // Fetch arguments for these topics (user_id is the author field)
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, content, side, upvotes')
    .in('topic_id', topicIds)

  // Build per-topic argument maps
  interface ArgEntry {
    count: number
    userIdSet: Set<string>
    topArg: { id: string; content: string; side: string; upvotes: number; user_id: string } | null
  }
  const argMap: Record<string, ArgEntry> = {}
  for (const a of argRows ?? []) {
    if (!argMap[a.topic_id]) {
      argMap[a.topic_id] = { count: 0, userIdSet: new Set(), topArg: null }
    }
    const entry = argMap[a.topic_id]
    entry.count++
    if (a.user_id) entry.userIdSet.add(a.user_id)
    if (!entry.topArg || (a.upvotes ?? 0) > (entry.topArg.upvotes ?? 0)) {
      entry.topArg = { id: a.id, content: a.content, side: a.side, upvotes: a.upvotes ?? 0, user_id: a.user_id }
    }
  }

  // Count replies per topic from argument_replies
  const { data: replyRows } = await supabase
    .from('argument_replies')
    .select('topic_id')
    .in('topic_id', topicIds)

  const replyCountMap: Record<string, number> = {}
  for (const r of replyRows ?? []) {
    replyCountMap[r.topic_id] = (replyCountMap[r.topic_id] ?? 0) + 1
  }

  // Fetch profiles for top argument authors
  const authorUserIds = Object.values(argMap)
    .map((m) => m.topArg?.user_id)
    .filter((id): id is string => !!id)

  const { data: authorProfiles } = authorUserIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorUserIds)
    : { data: [] }

  const profileMap = new Map((authorProfiles ?? []).map((p) => [p.id, p]))

  // Fetch debate counts
  const { data: debateCounts } = await supabase
    .from('debates')
    .select('topic_id')
    .in('topic_id', topicIds)
    .not('topic_id', 'is', null)

  const debateCountMap: Record<string, number> = {}
  for (const d of debateCounts ?? []) {
    if (d.topic_id) debateCountMap[d.topic_id] = (debateCountMap[d.topic_id] ?? 0) + 1
  }

  // Score topics — only include those with enough arguments
  const topics: VortexTopic[] = []
  for (const t of topicsRaw) {
    const entry = argMap[t.id]
    if (!entry || entry.count < MIN_ARGS) continue

    const argCount = entry.count
    const uniqueArguers = entry.userIdSet.size
    const replyCount = replyCountMap[t.id] ?? 0
    const debateCount = debateCountMap[t.id] ?? 0
    const votes = Math.max(t.total_votes, 1)

    const numerator = argCount * 12 + uniqueArguers * 8 + replyCount * 3
    const denominator = Math.log2(votes + 2)
    const vortexScore = Math.round((numerator / denominator) * 10) / 10
    const argDensity = Math.round(((argCount + replyCount) / votes) * 100) / 100

    let topArgument: VortexArgument | null = null
    if (entry.topArg) {
      const profile = profileMap.get(entry.topArg.user_id)
      topArgument = {
        id: entry.topArg.id,
        content: entry.topArg.content,
        side: entry.topArg.side as 'blue' | 'red',
        upvotes: entry.topArg.upvotes,
        author_username: profile?.username ?? null,
        author_display_name: profile?.display_name ?? null,
        author_avatar_url: profile?.avatar_url ?? null,
      }
    }

    topics.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes,
      argument_count: argCount,
      unique_arguers: uniqueArguers,
      reply_count: replyCount,
      debate_count: debateCount,
      vortex_score: vortexScore,
      arg_density: argDensity,
      created_at: t.created_at,
      top_argument: topArgument,
    })
  }

  // Sort
  if (sort === 'vortex') {
    topics.sort((a, b) => b.vortex_score - a.vortex_score)
  } else if (sort === 'density') {
    topics.sort((a, b) => b.arg_density - a.arg_density)
  } else if (sort === 'arguers') {
    topics.sort((a, b) => b.unique_arguers - a.unique_arguers)
  } else {
    topics.sort((a, b) => b.reply_count - a.reply_count)
  }

  const sliced = topics.slice(0, limit)

  // Stats
  const totalScore = topics.reduce((s, t) => s + t.vortex_score, 0)
  const avgScore = topics.length > 0 ? Math.round((totalScore / topics.length) * 10) / 10 : 0
  const totalArgs = topics.reduce((s, t) => s + t.argument_count, 0)

  const catScoreMap: Record<string, number> = {}
  for (const t of topics) {
    if (t.category) catScoreMap[t.category] = (catScoreMap[t.category] ?? 0) + t.vortex_score
  }
  const highestDensityCategory = Object.entries(catScoreMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return NextResponse.json({
    topics: sliced,
    stats: {
      total_qualified: topics.length,
      avg_vortex_score: avgScore,
      highest_density_category: highestDensityCategory,
      total_arguments_in_vortex: totalArgs,
    },
    generated_at: new Date().toISOString(),
  } satisfies VortexResponse)
}
