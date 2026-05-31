import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900  // 15 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepthTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  // Depth dimensions
  argument_count: number
  cited_arguments: number     // arguments with source_url
  avg_ai_score: number | null // avg of non-null ai_score (1–10)
  wiki_length: number         // char count of wiki body
  prediction_count: number    // topic_predictions rows
  reply_count: number         // argument replies
  // Computed
  depth_score: number         // 0–100 composite
  argument_density: number    // arguments per 100 votes
  citation_rate: number       // % of arguments with a citation
}

export interface CategoryDepth {
  category: string
  topic_count: number
  avg_depth_score: number
  avg_argument_density: number
  avg_citation_rate: number
  avg_ai_score: number | null
}

export interface PlatformDepthStats {
  total_topics_scored: number
  avg_depth_score: number
  avg_argument_density: number       // args per 100 votes across all topics
  avg_citation_rate: number          // % of args with a citation
  avg_ai_score: number | null
  deepest_category: string | null
  shallowest_category: string | null
}

export interface DepthResponse {
  topics: DepthTopic[]
  categories: CategoryDepth[]
  platform: PlatformDepthStats
}

// ─── Score calculation ────────────────────────────────────────────────────────

function computeDepthScore(t: {
  argument_count: number
  total_votes: number
  cited_arguments: number
  avg_ai_score: number | null
  wiki_length: number
  prediction_count: number
  reply_count: number
}): number {
  // Argument density (0–30 pts): 1 arg / 5 votes = full score
  const density = t.total_votes > 0 ? t.argument_count / t.total_votes : 0
  const densityScore = Math.min(30, density * 150)

  // Citation rate (0–20 pts): 50%+ citations = full score
  const citRate = t.argument_count > 0 ? t.cited_arguments / t.argument_count : 0
  const citScore = Math.min(20, citRate * 40)

  // AI quality (0–25 pts): avg_score 8+ = full, scaled from 1
  const aiScore = t.avg_ai_score !== null
    ? Math.min(25, ((t.avg_ai_score - 1) / 9) * 25)
    : 0

  // Wiki richness (0–15 pts): 2000+ chars = full score
  const wikiScore = Math.min(15, (t.wiki_length / 2000) * 15)

  // Prediction engagement (0–10 pts): 10+ predictions = full score
  const predScore = Math.min(10, (t.prediction_count / 10) * 10)

  // Reply depth (0–10 pts: per 5 replies)
  const replyScore = Math.min(10, (t.reply_count / 5) * 2)

  return Math.round(densityScore + citScore + aiScore + wikiScore + predScore + replyScore)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // ── 1. Core topic stats ───────────────────────────────────────────────────
    const { data: topicRows, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .not('total_votes', 'is', null)
      .gt('total_votes', 0)
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(200)

    if (topicErr) throw topicErr
    const topics = topicRows ?? []

    if (topics.length === 0) {
      return NextResponse.json({
        topics: [],
        categories: [],
        platform: {
          total_topics_scored: 0,
          avg_depth_score: 0,
          avg_argument_density: 0,
          avg_citation_rate: 0,
          avg_ai_score: null,
          deepest_category: null,
          shallowest_category: null,
        },
      } satisfies DepthResponse)
    }

    const topicIds = topics.map((t) => t.id)

    // ── 2. Argument stats per topic ───────────────────────────────────────────
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('topic_id, source_url, ai_score')
      .in('topic_id', topicIds)

    // aggregate per topic
    const argMap = new Map<
      string,
      { total: number; cited: number; scoreSum: number; scoreCount: number }
    >()
    for (const row of argRows ?? []) {
      if (!argMap.has(row.topic_id)) {
        argMap.set(row.topic_id, { total: 0, cited: 0, scoreSum: 0, scoreCount: 0 })
      }
      const m = argMap.get(row.topic_id)!
      m.total++
      if (row.source_url) m.cited++
      if (row.ai_score !== null) {
        m.scoreSum += row.ai_score
        m.scoreCount++
      }
    }

    // ── 3. Wiki lengths — read description directly from topics ──────────────
    // Topics store their wiki content in the `description` column.
    const { data: wikiRows } = await supabase
      .from('topics')
      .select('id, description')
      .in('id', topicIds)

    const wikiMap = new Map<string, number>()
    for (const row of wikiRows ?? []) {
      wikiMap.set(row.id, (row.description ?? '').length)
    }

    // ── 4. Prediction counts ──────────────────────────────────────────────────
    const { data: predRows } = await supabase
      .from('topic_predictions')
      .select('topic_id')
      .in('topic_id', topicIds)

    const predMap = new Map<string, number>()
    for (const row of predRows ?? []) {
      predMap.set(row.topic_id, (predMap.get(row.topic_id) ?? 0) + 1)
    }

    // ── 5. Reply counts ───────────────────────────────────────────────────────
    // argument_replies has a denormalized topic_id — aggregate directly
    const { data: replyRows } = await supabase
      .from('argument_replies')
      .select('topic_id')
      .in('topic_id', topicIds)

    const replyMap = new Map<string, number>()
    for (const row of replyRows ?? []) {
      replyMap.set(row.topic_id, (replyMap.get(row.topic_id) ?? 0) + 1)
    }

    // ── 6. Build depth topics ─────────────────────────────────────────────────
    const depthTopics: DepthTopic[] = topics.map((t) => {
      const args = argMap.get(t.id) ?? { total: 0, cited: 0, scoreSum: 0, scoreCount: 0 }
      const wiki_length = wikiMap.get(t.id) ?? 0
      const prediction_count = predMap.get(t.id) ?? 0
      const reply_count = replyMap.get(t.id) ?? 0
      const avg_ai_score = args.scoreCount > 0 ? args.scoreSum / args.scoreCount : null
      const total_votes = t.total_votes ?? 0
      const argument_density = total_votes > 0 ? (args.total / total_votes) * 100 : 0
      const citation_rate = args.total > 0 ? (args.cited / args.total) * 100 : 0

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_votes,
        blue_pct: t.blue_pct ?? 50,
        argument_count: args.total,
        cited_arguments: args.cited,
        avg_ai_score: avg_ai_score !== null ? Math.round(avg_ai_score * 10) / 10 : null,
        wiki_length,
        prediction_count,
        reply_count,
        depth_score: computeDepthScore({
          argument_count: args.total,
          total_votes,
          cited_arguments: args.cited,
          avg_ai_score,
          wiki_length,
          prediction_count,
          reply_count,
        }),
        argument_density: Math.round(argument_density * 10) / 10,
        citation_rate: Math.round(citation_rate),
      }
    })

    // Sort by depth score desc
    depthTopics.sort((a, b) => b.depth_score - a.depth_score)

    // Limit to top 50 for the page
    const topDepth = depthTopics.slice(0, 50)

    // ── 7. Category breakdown ─────────────────────────────────────────────────
    const catAgg = new Map<
      string,
      { count: number; scoreSum: number; densitySum: number; citSum: number; aiSum: number; aiCount: number }
    >()
    for (const t of depthTopics) {
      const cat = t.category ?? 'Other'
      if (!catAgg.has(cat)) {
        catAgg.set(cat, { count: 0, scoreSum: 0, densitySum: 0, citSum: 0, aiSum: 0, aiCount: 0 })
      }
      const m = catAgg.get(cat)!
      m.count++
      m.scoreSum += t.depth_score
      m.densitySum += t.argument_density
      m.citSum += t.citation_rate
      if (t.avg_ai_score !== null) {
        m.aiSum += t.avg_ai_score
        m.aiCount++
      }
    }

    const categories: CategoryDepth[] = Array.from(catAgg.entries())
      .map(([category, m]) => ({
        category,
        topic_count: m.count,
        avg_depth_score: Math.round(m.scoreSum / m.count),
        avg_argument_density: Math.round((m.densitySum / m.count) * 10) / 10,
        avg_citation_rate: Math.round(m.citSum / m.count),
        avg_ai_score: m.aiCount > 0 ? Math.round((m.aiSum / m.aiCount) * 10) / 10 : null,
      }))
      .sort((a, b) => b.avg_depth_score - a.avg_depth_score)

    // ── 8. Platform stats ─────────────────────────────────────────────────────
    const allScores = depthTopics.map((t) => t.depth_score)
    const allDensities = depthTopics.map((t) => t.argument_density)
    const allCitRates = depthTopics.map((t) => t.citation_rate)
    const aiScores = depthTopics.filter((t) => t.avg_ai_score !== null).map((t) => t.avg_ai_score!)

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

    const platform: PlatformDepthStats = {
      total_topics_scored: depthTopics.length,
      avg_depth_score: Math.round(avg(allScores)),
      avg_argument_density: Math.round(avg(allDensities) * 10) / 10,
      avg_citation_rate: Math.round(avg(allCitRates)),
      avg_ai_score: aiScores.length ? Math.round(avg(aiScores) * 10) / 10 : null,
      deepest_category: categories[0]?.category ?? null,
      shallowest_category: categories[categories.length - 1]?.category ?? null,
    }

    return NextResponse.json({
      topics: topDepth,
      categories,
      platform,
    } satisfies DepthResponse)
  } catch (err) {
    console.error('[/api/depth]', err)
    return NextResponse.json({ topics: [], categories: [], platform: { total_topics_scored: 0, avg_depth_score: 0, avg_argument_density: 0, avg_citation_rate: 0, avg_ai_score: null, deepest_category: null, shallowest_category: null } }, { status: 500 })
  }
}
