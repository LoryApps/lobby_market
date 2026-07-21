import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConfidenceBucket {
  label: string       // e.g. "10–20%"
  low: number
  high: number
  count: number
  pct: number         // share of all predictors
}

export interface CohortStats {
  label: string
  cohort: 'smart_money' | 'experienced' | 'newcomer'
  count: number
  avg_confidence: number   // 0–100 (predicted FOR probability)
  pct_predicting_law: number
  avg_brier: number | null
}

export interface PredictorSnapshot {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  role: string
  predicted_law: boolean
  confidence: number
  correct: boolean | null
}

export interface CrowdData {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  total_votes: number
  total_predictors: number
  pct_predicting_law: number
  avg_confidence: number
  smart_money_signal: number | null   // high-clout users avg confidence
  retail_signal: number | null        // lower-clout users avg confidence
  signal_divergence: number | null    // smart_money - retail (+ means smart money more bullish)
  cohorts: CohortStats[]
  confidence_distribution: ConfidenceBucket[]
  top_predictors: PredictorSnapshot[]
  prediction_vs_price: number         // avg predicted confidence minus current price (divergence)
  crowd_conviction: 'high' | 'medium' | 'low'  // std dev of predictions
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // ── Fetch topic basics ──────────────────────────────────────────────────
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .maybeSingle()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const price = Math.round(topic.blue_pct ?? 50)

    // ── Fetch predictions with profile clout ───────────────────────────────
    const { data: preds } = await supabase
      .from('topic_predictions')
      .select(`
        predicted_law,
        confidence,
        correct,
        brier_score,
        profiles!inner(
          id,
          username,
          display_name,
          avatar_url,
          clout,
          role
        )
      `)
      .eq('topic_id', params.id)
      .order('created_at', { ascending: false })
      .limit(200)

    const predictions = (preds ?? []) as Array<{
      predicted_law: boolean
      confidence: number
      correct: boolean | null
      brier_score: number | null
      profiles: {
        id: string
        username: string
        display_name: string | null
        avatar_url: string | null
        clout: number
        role: string
      }
    }>

    const total_predictors = predictions.length

    if (total_predictors === 0) {
      const empty: CrowdData = {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        price,
        total_votes: topic.total_votes ?? 0,
        total_predictors: 0,
        pct_predicting_law: 0,
        avg_confidence: price,
        smart_money_signal: null,
        retail_signal: null,
        signal_divergence: null,
        cohorts: [],
        confidence_distribution: [],
        top_predictors: [],
        prediction_vs_price: 0,
        crowd_conviction: 'low',
      }
      return NextResponse.json(empty)
    }

    // Convert predicted_law + confidence into a 0–100 "bullish" score:
    // If predicted_law=true, bullish = confidence (1–100 mapped to 1–100)
    // If predicted_law=false, bullish = 100 - confidence
    function bullishScore(p: typeof predictions[number]): number {
      return p.predicted_law ? p.confidence : 100 - p.confidence
    }

    const bullishScores = predictions.map(bullishScore)
    const avg_confidence = Math.round(
      bullishScores.reduce((a, b) => a + b, 0) / bullishScores.length
    )
    const pct_predicting_law = Math.round(
      (predictions.filter((p) => p.predicted_law).length / total_predictors) * 100
    )

    // ── Cohort split ───────────────────────────────────────────────────────
    const smartMoney = predictions.filter((p) => p.profiles.clout >= 1000)
    const experienced = predictions.filter(
      (p) => p.profiles.clout >= 100 && p.profiles.clout < 1000
    )
    const newcomer = predictions.filter((p) => p.profiles.clout < 100)

    function cohortStats(
      group: typeof predictions,
      label: string,
      cohort: CohortStats['cohort']
    ): CohortStats {
      if (group.length === 0) {
        return { label, cohort, count: 0, avg_confidence: avg_confidence, pct_predicting_law, avg_brier: null }
      }
      const scores = group.map(bullishScore)
      const avgConf = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      const pctLaw = Math.round(
        (group.filter((p) => p.predicted_law).length / group.length) * 100
      )
      const briers = group.filter((p) => p.brier_score !== null).map((p) => p.brier_score as number)
      const avgBrier = briers.length > 0
        ? Math.round((briers.reduce((a, b) => a + b, 0) / briers.length) * 1000) / 1000
        : null
      return { label, cohort, count: group.length, avg_confidence: avgConf, pct_predicting_law: pctLaw, avg_brier: avgBrier }
    }

    const cohorts: CohortStats[] = [
      cohortStats(smartMoney, 'Smart Money (1000+ Clout)', 'smart_money'),
      cohortStats(experienced, 'Experienced (100–999 Clout)', 'experienced'),
      cohortStats(newcomer, 'Newcomers (<100 Clout)', 'newcomer'),
    ].filter((c) => c.count > 0)

    const smart_money_signal = smartMoney.length > 0
      ? Math.round(smartMoney.map(bullishScore).reduce((a, b) => a + b, 0) / smartMoney.length)
      : null
    const retail_signal = newcomer.length > 0
      ? Math.round(newcomer.map(bullishScore).reduce((a, b) => a + b, 0) / newcomer.length)
      : null
    const signal_divergence = smart_money_signal !== null && retail_signal !== null
      ? smart_money_signal - retail_signal
      : null

    // ── Confidence distribution ─────────────────────────────────────────────
    const BUCKETS = [
      { label: '0–20%', low: 0, high: 20 },
      { label: '21–40%', low: 21, high: 40 },
      { label: '41–60%', low: 41, high: 60 },
      { label: '61–80%', low: 61, high: 80 },
      { label: '81–100%', low: 81, high: 100 },
    ]
    const confidence_distribution: ConfidenceBucket[] = BUCKETS.map((b) => {
      const count = bullishScores.filter((s) => s >= b.low && s <= b.high).length
      return { ...b, count, pct: total_predictors > 0 ? Math.round((count / total_predictors) * 100) : 0 }
    })

    // ── Top predictors ─────────────────────────────────────────────────────
    const sorted = [...predictions].sort((a, b) => b.profiles.clout - a.profiles.clout)
    const top_predictors: PredictorSnapshot[] = sorted.slice(0, 10).map((p) => ({
      id: p.profiles.id,
      username: p.profiles.username,
      display_name: p.profiles.display_name,
      avatar_url: p.profiles.avatar_url,
      clout: p.profiles.clout,
      role: p.profiles.role,
      predicted_law: p.predicted_law,
      confidence: bullishScore(p),
      correct: p.correct,
    }))

    // ── Crowd conviction (std dev of bullish scores) ─────────────────────────
    const sd = stdDev(bullishScores)
    const crowd_conviction: CrowdData['crowd_conviction'] =
      sd < 15 ? 'high' : sd < 30 ? 'medium' : 'low'

    const prediction_vs_price = avg_confidence - price

    const result: CrowdData = {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price,
      total_votes: topic.total_votes ?? 0,
      total_predictors,
      pct_predicting_law,
      avg_confidence,
      smart_money_signal,
      retail_signal,
      signal_divergence,
      cohorts,
      confidence_distribution,
      top_predictors,
      prediction_vs_price,
      crowd_conviction,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[exchange/crowd] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
