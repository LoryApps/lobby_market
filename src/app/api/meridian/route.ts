import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 120 // refresh every 2 min

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeridianTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  /** Number of arguments posted */
  argument_count: number
  /** Number of debates held / scheduled */
  debate_count: number
  /** Days since the topic was created */
  age_days: number
  /**
   * Meridian Score = engagement_score × contest_multiplier
   *
   * engagement_score  = total_votes + argument_count * 8 + debate_count * 25
   *   (arguments and debates are weighted more highly than passive votes)
   *
   * contest_multiplier = 1 – |blue_pct – 50| / 50
   *   = 1.0 at perfect 50/50, 0.0 at 100/0 or 0/100
   *
   * Topics with many votes AND stuck near 50/50 rise to the top.
   */
  meridian_score: number
  created_at: string
}

export interface MeridianStats {
  total_qualified: number
  avg_meridian_score: number
  most_contested_category: string | null
  avg_age_days: number
}

export interface MeridianResponse {
  topics: MeridianTopic[]
  stats: MeridianStats
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_VOTES = 20
const MIN_CONTEST_BAND = 20   // blue_pct must be within 20–80 to qualify
const MAX_RESULTS = 50

// ─── GET /api/meridian ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') ?? null
  const sort = (searchParams.get('sort') ?? 'meridian') as 'meridian' | 'votes' | 'contest'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), MAX_RESULTS)

  const supabase = await createClient()

  // Fetch contested active/voting topics
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', MIN_VOTES)
    .gte('blue_pct', MIN_CONTEST_BAND)
    .lte('blue_pct', 100 - MIN_CONTEST_BAND)

  if (category) query = query.eq('category', category)

  query = query.order('total_votes', { ascending: false }).limit(MAX_RESULTS)

  const { data: topicsRaw, error } = await query

  if (error || !topicsRaw) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  if (topicsRaw.length === 0) {
    return NextResponse.json({
      topics: [],
      stats: {
        total_qualified: 0,
        avg_meridian_score: 0,
        most_contested_category: null,
        avg_age_days: 0,
      },
      generated_at: new Date().toISOString(),
    } satisfies MeridianResponse)
  }

  const topicIds = topicsRaw.map((t) => t.id)

  // Fetch argument counts per topic
  const { data: argCounts } = await supabase
    .from('arguments')
    .select('topic_id')
    .in('topic_id', topicIds)

  const argCountMap: Record<string, number> = {}
  for (const a of argCounts ?? []) {
    argCountMap[a.topic_id] = (argCountMap[a.topic_id] ?? 0) + 1
  }

  // Fetch debate counts per topic
  const { data: debateCounts } = await supabase
    .from('debates')
    .select('topic_id')
    .in('topic_id', topicIds)
    .not('topic_id', 'is', null)

  const debateCountMap: Record<string, number> = {}
  for (const d of debateCounts ?? []) {
    if (d.topic_id) {
      debateCountMap[d.topic_id] = (debateCountMap[d.topic_id] ?? 0) + 1
    }
  }

  const now = Date.now()

  // Build scored topics
  const topics: MeridianTopic[] = topicsRaw.map((t) => {
    const argCount = argCountMap[t.id] ?? 0
    const debateCount = debateCountMap[t.id] ?? 0
    const ageDays = Math.max(1, (now - new Date(t.created_at).getTime()) / 86_400_000)

    const engagementScore = t.total_votes + argCount * 8 + debateCount * 25
    const contestMultiplier = 1 - Math.abs((t.blue_pct ?? 50) - 50) / 50
    const meridianScore = Math.round(engagementScore * contestMultiplier)

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes,
      argument_count: argCount,
      debate_count: debateCount,
      age_days: Math.floor(ageDays),
      meridian_score: meridianScore,
      created_at: t.created_at,
    }
  })

  // Sort
  if (sort === 'meridian') {
    topics.sort((a, b) => b.meridian_score - a.meridian_score)
  } else if (sort === 'votes') {
    topics.sort((a, b) => b.total_votes - a.total_votes)
  } else {
    // 'contest' — closest to 50/50
    topics.sort((a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50))
  }

  const sliced = topics.slice(0, limit)

  // Stats
  const totalScore = topics.reduce((s, t) => s + t.meridian_score, 0)
  const avgScore = topics.length > 0 ? Math.round(totalScore / topics.length) : 0
  const avgAge = topics.length > 0
    ? Math.round(topics.reduce((s, t) => s + t.age_days, 0) / topics.length)
    : 0

  const catMap: Record<string, number> = {}
  for (const t of topics) {
    if (t.category) catMap[t.category] = (catMap[t.category] ?? 0) + 1
  }
  const mostContestedCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return NextResponse.json({
    topics: sliced,
    stats: {
      total_qualified: topics.length,
      avg_meridian_score: avgScore,
      most_contested_category: mostContestedCategory,
      avg_age_days: avgAge,
    },
    generated_at: new Date().toISOString(),
  } satisfies MeridianResponse)
}
