import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DivergentMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  crowd_signal: number      // avg predicted probability
  divergence: number        // crowd_signal - price
  predictor_count: number
  pct_predicting_law: number
}

export interface PlatformStats {
  total_predictors: number
  total_predictions: number
  avg_brier_score: number | null
  pct_correct: number | null  // resolved predictions only
  smart_money_accuracy: number | null
  retail_accuracy: number | null
}

export interface CrowdGlobalData {
  platform: PlatformStats
  most_divergent: DivergentMarket[]   // crowd more bullish than market
  most_bearish_vs_price: DivergentMarket[]   // crowd more bearish than market
  most_predicted: DivergentMarket[]
  total_active_markets: number
}

export async function GET() {
  try {
    const supabase = await createClient()

    // ── Platform-wide stats ──────────────────────────────────────────────────
    // Count unique predictors
    const { count: totalPreds } = await supabase
      .from('topic_predictions')
      .select('*', { count: 'exact', head: true })

    const { count: totalPredictors } = await supabase
      .from('topic_predictions')
      .select('user_id', { count: 'exact', head: true })

    // Avg brier score for resolved predictions
    const { data: brierData } = await supabase
      .from('topic_predictions')
      .select('brier_score, correct, profiles!inner(clout)')
      .not('brier_score', 'is', null)
      .limit(1000)

    const brierRows = (brierData ?? []) as Array<{
      brier_score: number | null
      correct: boolean | null
      profiles: { clout: number }
    }>

    const resolvedRows = brierRows.filter((r) => r.brier_score !== null)
    const avgBrier = resolvedRows.length > 0
      ? Math.round((resolvedRows.reduce((s, r) => s + (r.brier_score ?? 0), 0) / resolvedRows.length) * 1000) / 1000
      : null

    const correctRows = brierRows.filter((r) => r.correct !== null)
    const pctCorrect = correctRows.length > 0
      ? Math.round((correctRows.filter((r) => r.correct === true).length / correctRows.length) * 100)
      : null

    const smartRows = brierRows.filter((r) => r.profiles.clout >= 1000 && r.correct !== null)
    const retailRows = brierRows.filter((r) => r.profiles.clout < 100 && r.correct !== null)
    const smartAccuracy = smartRows.length > 0
      ? Math.round((smartRows.filter((r) => r.correct === true).length / smartRows.length) * 100)
      : null
    const retailAccuracy = retailRows.length > 0
      ? Math.round((retailRows.filter((r) => r.correct === true).length / retailRows.length) * 100)
      : null

    const platform: PlatformStats = {
      total_predictors: totalPredictors ?? 0,
      total_predictions: totalPreds ?? 0,
      avg_brier_score: avgBrier,
      pct_correct: pctCorrect,
      smart_money_accuracy: smartAccuracy,
      retail_accuracy: retailAccuracy,
    }

    // ── Per-topic crowd aggregates ───────────────────────────────────────────
    const { data: statsRows } = await supabase
      .from('topic_prediction_stats')
      .select('topic_id, total_predictions, law_confidence')
      .gt('total_predictions', 2)
      .order('total_predictions', { ascending: false })
      .limit(100)

    if (!statsRows || statsRows.length === 0) {
      return NextResponse.json({
        platform,
        most_divergent: [],
        most_bearish_vs_price: [],
        most_predicted: [],
        total_active_markets: 0,
      } satisfies CrowdGlobalData)
    }

    const topicIds = statsRows.map((r) => r.topic_id)

    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct')
      .in('id', topicIds)
      .in('status', ['proposed', 'active', 'voting'])

    const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

    // ── Count unique predictors per topic from predictions ───────────────────
    const { data: countRows } = await supabase
      .from('topic_predictions')
      .select('topic_id, predicted_law, confidence')
      .in('topic_id', topicIds)
      .limit(2000)

    type PredRow = { topic_id: string; predicted_law: boolean; confidence: number }
    const predsByTopic = new Map<string, PredRow[]>()
    for (const r of (countRows ?? []) as PredRow[]) {
      const arr = predsByTopic.get(r.topic_id) ?? []
      arr.push(r)
      predsByTopic.set(r.topic_id, arr)
    }

    const enriched: DivergentMarket[] = []

    for (const stats of statsRows) {
      const topic = topicMap.get(stats.topic_id)
      if (!topic) continue
      const price = Math.round(topic.blue_pct ?? 50)
      const crowd_signal = Math.round(stats.law_confidence ?? 50)
      const divergence = crowd_signal - price
      const preds = predsByTopic.get(stats.topic_id) ?? []
      const pct_predicting_law = preds.length > 0
        ? Math.round((preds.filter((p) => p.predicted_law).length / preds.length) * 100)
        : 0

      enriched.push({
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        price,
        crowd_signal,
        divergence,
        predictor_count: stats.total_predictions,
        pct_predicting_law,
      })
    }

    // Sort into different lists
    const bullish = [...enriched].filter((m) => m.divergence > 0).sort((a, b) => b.divergence - a.divergence)
    const bearish = [...enriched].filter((m) => m.divergence < 0).sort((a, b) => a.divergence - b.divergence)
    const predicted = [...enriched].sort((a, b) => b.predictor_count - a.predictor_count)

    return NextResponse.json({
      platform,
      most_divergent: bullish.slice(0, 10),
      most_bearish_vs_price: bearish.slice(0, 10),
      most_predicted: predicted.slice(0, 10),
      total_active_markets: enriched.length,
    } satisfies CrowdGlobalData)
  } catch (err) {
    console.error('[exchange/crowd global] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
