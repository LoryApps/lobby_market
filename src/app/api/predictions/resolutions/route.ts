import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedPredictionTopic {
  topic_id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  blue_pct: number
  total_votes: number
  resolved_at: string
  /** Aggregate crowd prediction (0-100) — % of predictors who said "will become law" */
  law_confidence: number
  total_predictions: number
  /** How many predictors were correct */
  correct_count: number
  /** Collective accuracy on this topic (0-100) */
  collective_accuracy: number
  /**
   * Surprise score 0-1: distance between crowd confidence and actual outcome.
   * 0 = crowd nailed it; 1 = maximum upset.
   * Formula: |law_confidence/100 - (is_law ? 1 : 0)|
   */
  surprise_score: number
  /** "upset" = crowd was wrong majority opinion; "vindicated" = crowd was right */
  verdict: 'upset' | 'vindicated' | 'split'
  /** Best forecaster on this topic (most correct with highest confidence) */
  top_forecasters: Array<{
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    predicted_law: boolean
    confidence: number
    correct: boolean
    clout_earned: number
  }>
}

export interface ResolutionsStats {
  total_resolved: number
  collective_accuracy_pct: number
  total_upsets: number
  biggest_upset: { topic_id: string; statement: string; surprise_score: number } | null
  avg_predictions_per_topic: number
  window_label: string
}

export interface ResolutionsResponse {
  topics: ResolvedPredictionTopic[]
  stats: ResolutionsStats
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const days  = Math.min(90, Math.max(7, parseInt(searchParams.get('days') ?? '30', 10) || 30))
  const cat   = searchParams.get('category') || null
  const sort  = (searchParams.get('sort') ?? 'surprise') as 'surprise' | 'predictions' | 'recent'
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get('limit') ?? '24', 10) || 24))

  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Find resolved topics with prediction stats ──────────────────────────
  let topicsQ = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, updated_at')
    .in('status', ['law', 'failed'])
    .gte('updated_at', windowStart)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (cat) topicsQ = topicsQ.eq('category', cat)

  const { data: topicsRaw, error: topicsErr } = await topicsQ
  if (topicsErr) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  const topics = (topicsRaw ?? []) as Array<{
    id: string; statement: string; category: string | null
    status: string; blue_pct: number; total_votes: number; updated_at: string
  }>

  if (topics.length === 0) {
    return NextResponse.json({
      topics: [],
      stats: {
        total_resolved: 0,
        collective_accuracy_pct: 0,
        total_upsets: 0,
        biggest_upset: null,
        avg_predictions_per_topic: 0,
        window_label: `${days}d`,
      },
      generated_at: new Date().toISOString(),
    } satisfies ResolutionsResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // ── 2. Fetch prediction stats for these topics ─────────────────────────────
  const { data: statsRaw } = await supabase
    .from('topic_prediction_stats')
    .select('topic_id, law_confidence, total_predictions')
    .in('topic_id', topicIds)
    .gt('total_predictions', 0)

  const statsMap = new Map(
    (statsRaw ?? []).map((s) => [s.topic_id, s as {
      topic_id: string; law_confidence: number; total_predictions: number
    }])
  )

  // Only include topics that actually have predictions
  const topicsWithPredictions = topics.filter((t) => statsMap.has(t.id))

  if (topicsWithPredictions.length === 0) {
    return NextResponse.json({
      topics: [],
      stats: {
        total_resolved: 0,
        collective_accuracy_pct: 0,
        total_upsets: 0,
        biggest_upset: null,
        avg_predictions_per_topic: 0,
        window_label: `${days}d`,
      },
      generated_at: new Date().toISOString(),
    } satisfies ResolutionsResponse)
  }

  // ── 3. Fetch per-prediction data for correct counts and top forecasters ────
  const { data: predsRaw } = await supabase
    .from('topic_predictions')
    .select(`
      topic_id,
      user_id,
      predicted_law,
      confidence,
      correct,
      clout_earned,
      profiles!inner (username, display_name, avatar_url)
    `)
    .in('topic_id', topicsWithPredictions.map((t) => t.id))
    .not('correct', 'is', null)
    .order('clout_earned', { ascending: false })
    .limit(1000)

  type PredRow = {
    topic_id: string
    user_id: string
    predicted_law: boolean
    confidence: number
    correct: boolean | null
    clout_earned: number
    profiles: { username: string; display_name: string | null; avatar_url: string | null }
  }

  const allPreds = (predsRaw ?? []) as unknown as PredRow[]

  // Group predictions by topic
  const predsByTopic = new Map<string, PredRow[]>()
  for (const p of allPreds) {
    const arr = predsByTopic.get(p.topic_id) ?? []
    arr.push(p)
    predsByTopic.set(p.topic_id, arr)
  }

  // ── 4. Build result items ──────────────────────────────────────────────────
  const resultTopics: ResolvedPredictionTopic[] = []

  for (const t of topicsWithPredictions) {
    const stats = statsMap.get(t.id)!
    const preds = predsByTopic.get(t.id) ?? []

    const isLaw = t.status === 'law'
    const lawConf = stats.law_confidence ?? 50
    const surpriseScore = Math.abs(lawConf / 100 - (isLaw ? 1 : 0))

    // Correct count (from resolved predictions)
    const correctCount = preds.filter((p) => p.correct === true).length
    const totalResolved = preds.filter((p) => p.correct !== null).length
    const collectiveAccuracy = totalResolved > 0 ? Math.round((correctCount / totalResolved) * 100) : 0

    // Verdict
    const crowdSaidLaw = lawConf >= 50
    let verdict: 'upset' | 'vindicated' | 'split'
    if (Math.abs(lawConf - 50) < 10) {
      verdict = 'split'
    } else if (crowdSaidLaw === isLaw) {
      verdict = 'vindicated'
    } else {
      verdict = 'upset'
    }

    // Top forecasters: correct predictions sorted by confidence (highest confidence correct = best)
    const topForecasters = preds
      .filter((p) => p.correct === true)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((p) => ({
        user_id: p.user_id,
        username: p.profiles.username,
        display_name: p.profiles.display_name,
        avatar_url: p.profiles.avatar_url,
        predicted_law: p.predicted_law,
        confidence: p.confidence,
        correct: true as boolean,
        clout_earned: p.clout_earned,
      }))

    resultTopics.push({
      topic_id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status as 'law' | 'failed',
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      resolved_at: t.updated_at,
      law_confidence: lawConf,
      total_predictions: stats.total_predictions,
      correct_count: correctCount,
      collective_accuracy: collectiveAccuracy,
      surprise_score: surpriseScore,
      verdict,
      top_forecasters: topForecasters,
    })
  }

  // ── 5. Sort ────────────────────────────────────────────────────────────────
  if (sort === 'surprise') {
    resultTopics.sort((a, b) => b.surprise_score - a.surprise_score)
  } else if (sort === 'predictions') {
    resultTopics.sort((a, b) => b.total_predictions - a.total_predictions)
  } else {
    resultTopics.sort((a, b) => new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime())
  }

  const sliced = resultTopics.slice(0, limit)

  // ── 6. Aggregate stats ────────────────────────────────────────────────────
  const totalResolved = resultTopics.length
  const totalUpsets = resultTopics.filter((t) => t.verdict === 'upset').length
  const avgAccuracy =
    totalResolved > 0
      ? Math.round(resultTopics.reduce((sum, t) => sum + t.collective_accuracy, 0) / totalResolved)
      : 0
  const avgPredictions =
    totalResolved > 0
      ? Math.round(resultTopics.reduce((sum, t) => sum + t.total_predictions, 0) / totalResolved)
      : 0
  const biggestUpset = resultTopics.length > 0
    ? resultTopics.reduce((best, t) => t.surprise_score > best.surprise_score ? t : best)
    : null

  const windowLabel = days <= 7 ? '7 days' : days <= 30 ? '30 days' : '90 days'

  return NextResponse.json({
    topics: sliced,
    stats: {
      total_resolved: totalResolved,
      collective_accuracy_pct: avgAccuracy,
      total_upsets: totalUpsets,
      biggest_upset: biggestUpset
        ? { topic_id: biggestUpset.topic_id, statement: biggestUpset.statement, surprise_score: biggestUpset.surprise_score }
        : null,
      avg_predictions_per_topic: avgPredictions,
      window_label: windowLabel,
    },
    generated_at: new Date().toISOString(),
  } satisfies ResolutionsResponse)
}
