import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600  // 10 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UncertainTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  // Uncertainty dimensions
  for_args: number
  against_args: number
  vote_contestedness: number   // 0–1: how close to 50/50
  argument_balance: number     // 0–1: how balanced FOR vs AGAINST args are
  engagement_weight: number    // log10 scale based on total_votes
  // Computed
  uncertainty_score: number    // 0–100 composite
  margin: number               // absolute distance from 50% (lower = more uncertain)
}

export interface CategoryUncertainty {
  category: string
  topic_count: number
  avg_uncertainty_score: number
  avg_margin: number
  most_uncertain_topic: string | null
}

export interface UncertaintyStats {
  total_topics_scored: number
  avg_uncertainty_score: number
  avg_margin: number
  most_uncertain_category: string | null
  least_uncertain_category: string | null
  perfectly_split_count: number   // margin < 5%
}

export interface UncertaintyResponse {
  topics: UncertainTopic[]
  categories: CategoryUncertainty[]
  stats: UncertaintyStats
}

// ─── Score calculation ─────────────────────────────────────────────────────────

function computeUncertaintyScore(t: {
  blue_pct: number
  total_votes: number
  for_args: number
  against_args: number
}): {
  score: number
  vote_contestedness: number
  argument_balance: number
  engagement_weight: number
  margin: number
} {
  const margin = Math.abs(t.blue_pct - 50)

  // Vote contestedness: 1 when exactly 50/50, 0 when unanimous
  const vote_contestedness = Math.max(0, 1 - margin / 50)

  // Argument balance: 1 when perfectly equal FOR/AGAINST args, 0 when all one side
  const maxArgs = Math.max(t.for_args, t.against_args)
  const minArgs = Math.min(t.for_args, t.against_args)
  const argument_balance = maxArgs > 0 ? minArgs / maxArgs : 0

  // Engagement weight: log10 scale so 100 votes → ~2, 1000 votes → ~3, 10k → ~4
  const engagement_weight = Math.log10(Math.max(1, t.total_votes))

  // Composite: contestedness (50%) + argument balance (30%) + engagement (20%)
  // Scale to 0–100
  const raw =
    vote_contestedness * 50 +
    argument_balance * 30 +
    Math.min(1, engagement_weight / 4) * 20  // normalise to 4 (10k votes = full)

  return {
    score: Math.round(raw),
    vote_contestedness: Math.round(vote_contestedness * 100) / 100,
    argument_balance: Math.round(argument_balance * 100) / 100,
    engagement_weight: Math.round(engagement_weight * 10) / 10,
    margin: Math.round(margin * 10) / 10,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // 1. Fetch topics with enough votes
    const { data: topicRows, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .not('total_votes', 'is', null)
      .gte('total_votes', 20)  // minimum participation threshold
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(300)

    if (topicErr) throw topicErr
    const topics = topicRows ?? []

    if (topics.length === 0) {
      return NextResponse.json({
        topics: [],
        categories: [],
        stats: {
          total_topics_scored: 0,
          avg_uncertainty_score: 0,
          avg_margin: 50,
          most_uncertain_category: null,
          least_uncertain_category: null,
          perfectly_split_count: 0,
        },
      } satisfies UncertaintyResponse)
    }

    const topicIds = topics.map((t) => t.id)

    // 2. Count FOR and AGAINST arguments per topic
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('topic_id, side')
      .in('topic_id', topicIds)

    const argMap = new Map<string, { for_args: number; against_args: number }>()
    for (const row of argRows ?? []) {
      if (!argMap.has(row.topic_id)) {
        argMap.set(row.topic_id, { for_args: 0, against_args: 0 })
      }
      const m = argMap.get(row.topic_id)!
      if (row.side === 'blue') m.for_args++
      else if (row.side === 'red') m.against_args++
    }

    // 3. Build uncertainty topics
    const uncertainTopics: UncertainTopic[] = topics.map((t) => {
      const args = argMap.get(t.id) ?? { for_args: 0, against_args: 0 }
      const computed = computeUncertaintyScore({
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        for_args: args.for_args,
        against_args: args.against_args,
      })

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_votes: t.total_votes ?? 0,
        blue_pct: t.blue_pct ?? 50,
        for_args: args.for_args,
        against_args: args.against_args,
        ...computed,
      }
    })

    // Sort by uncertainty score descending
    uncertainTopics.sort((a, b) => b.uncertainty_score - a.uncertainty_score)

    // Top 50 for display
    const topUncertain = uncertainTopics.slice(0, 50)

    // 4. Category breakdown
    const catAgg = new Map<
      string,
      {
        count: number
        scoreSum: number
        marginSum: number
        mostUncertain: UncertainTopic | null
      }
    >()

    for (const t of uncertainTopics) {
      const cat = t.category ?? 'Other'
      if (!catAgg.has(cat)) {
        catAgg.set(cat, { count: 0, scoreSum: 0, marginSum: 0, mostUncertain: null })
      }
      const m = catAgg.get(cat)!
      m.count++
      m.scoreSum += t.uncertainty_score
      m.marginSum += t.margin
      if (!m.mostUncertain || t.uncertainty_score > m.mostUncertain.uncertainty_score) {
        m.mostUncertain = t
      }
    }

    const categories: CategoryUncertainty[] = Array.from(catAgg.entries())
      .map(([category, m]) => ({
        category,
        topic_count: m.count,
        avg_uncertainty_score: Math.round(m.scoreSum / m.count),
        avg_margin: Math.round((m.marginSum / m.count) * 10) / 10,
        most_uncertain_topic: m.mostUncertain?.statement ?? null,
      }))
      .sort((a, b) => b.avg_uncertainty_score - a.avg_uncertainty_score)

    // 5. Platform stats
    const allScores = uncertainTopics.map((t) => t.uncertainty_score)
    const allMargins = uncertainTopics.map((t) => t.margin)
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const stats: UncertaintyStats = {
      total_topics_scored: uncertainTopics.length,
      avg_uncertainty_score: Math.round(avg(allScores)),
      avg_margin: Math.round(avg(allMargins) * 10) / 10,
      most_uncertain_category: categories[0]?.category ?? null,
      least_uncertain_category: categories[categories.length - 1]?.category ?? null,
      perfectly_split_count: uncertainTopics.filter((t) => t.margin < 5).length,
    }

    return NextResponse.json({
      topics: topUncertain,
      categories,
      stats,
    } satisfies UncertaintyResponse)
  } catch (err) {
    console.error('[/api/uncertainty]', err)
    return NextResponse.json(
      {
        topics: [],
        categories: [],
        stats: {
          total_topics_scored: 0,
          avg_uncertainty_score: 0,
          avg_margin: 50,
          most_uncertain_category: null,
          least_uncertain_category: null,
          perfectly_split_count: 0,
        },
      },
      { status: 500 }
    )
  }
}
