import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelFactor {
  name: string
  weight: number          // 0-100, contribution to fair value
  value: number           // Raw factor value (price-like, 0-100)
  impact: 'positive' | 'negative' | 'neutral'
  description: string
}

export interface ModelResponse {
  statement: string
  category: string | null
  status: string
  current_price: number
  fair_value: number
  verdict: 'overvalued' | 'fairly_valued' | 'undervalued'
  verdict_strength: 'strong' | 'moderate' | 'slight'
  confidence: number        // 0-100, model confidence based on data quality
  factors: ModelFactor[]
  benchmarks: {
    category_avg: number | null
    category_law_rate: number | null
    similar_avg: number | null
  }
  forecaster: {
    count: number
    avg_target: number | null
    bullish_pct: number
    bearish_pct: number
    neutral_pct: number
    avg_confidence: number
  }
  argument_quality: {
    for_avg: number | null
    against_avg: number | null
    quality_signal: 'for_leads' | 'against_leads' | 'balanced' | 'no_data'
  }
  volume_signal: 'high' | 'medium' | 'low'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function avgOrNull(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', id)
    .single()

  if (error || !topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const currentPrice = Math.round(topic.blue_pct ?? 50)

  // ── 2. Category benchmark ─────────────────────────────────────────────────
  const [categoryRes, lawRateRes, similarRes] = await Promise.all([
    topic.category
      ? supabase
          .from('topics')
          .select('blue_pct')
          .eq('category', topic.category)
          .not('status', 'eq', 'archived')
          .neq('id', id)
          .limit(100)
      : Promise.resolve({ data: null }),

    topic.category
      ? supabase
          .from('topics')
          .select('status', { count: 'exact' })
          .eq('category', topic.category)
          .in('status', ['law', 'active', 'voting', 'failed'])
      : Promise.resolve({ data: null, count: null }),

    supabase
      .from('topics')
      .select('blue_pct')
      .eq('status', topic.status)
      .neq('id', id)
      .limit(50),
  ])

  const categoryPrices = (categoryRes.data ?? []).map((t) => t.blue_pct ?? 50).filter(Boolean)
  const categoryAvg = avgOrNull(categoryPrices)

  const allInCategory = (lawRateRes.data ?? [])
  const lawCount = allInCategory.filter((t) => t.status === 'law').length
  const categoryLawRate = allInCategory.length > 0
    ? (lawCount / allInCategory.length) * 100
    : null

  const similarPrices = (similarRes.data ?? []).map((t) => t.blue_pct ?? 50).filter(Boolean)
  const similarAvg = avgOrNull(similarPrices)

  // ── 3. Forecasts ──────────────────────────────────────────────────────────
  const { data: forecasts } = await supabase
    .from('exchange_forecasts')
    .select('target_price, direction, confidence')
    .eq('topic_id', id)
    .limit(200)

  const fc = forecasts ?? []
  const fcCount = fc.length

  const bullish = fc.filter((f) => f.direction === 'bullish')
  const bearish = fc.filter((f) => f.direction === 'bearish')
  const neutral = fc.filter((f) => f.direction === 'neutral')

  const bullishPct = fcCount > 0 ? (bullish.length / fcCount) * 100 : 0
  const bearishPct = fcCount > 0 ? (bearish.length / fcCount) * 100 : 0
  const neutralPct = fcCount > 0 ? (neutral.length / fcCount) * 100 : 0

  // Weighted average target (by confidence)
  let weightedTarget: number | null = null
  if (fcCount > 0) {
    const totalWeight = fc.reduce((s, f) => s + (f.confidence ?? 50), 0)
    if (totalWeight > 0) {
      weightedTarget = fc.reduce(
        (s, f) => s + (f.target_price ?? currentPrice) * (f.confidence ?? 50),
        0,
      ) / totalWeight
    }
  }

  const avgConfidence = fcCount > 0
    ? fc.reduce((s, f) => s + (f.confidence ?? 50), 0) / fcCount
    : 0

  // ── 4. Argument quality ───────────────────────────────────────────────────
  const { data: argScores } = await supabase
    .from('topic_arguments')
    .select('side, ai_score')
    .eq('topic_id', id)
    .not('ai_score', 'is', null)
    .limit(100)

  const forScores = (argScores ?? [])
    .filter((a) => a.side === 'blue' && a.ai_score !== null)
    .map((a) => a.ai_score as number)

  const againstScores = (argScores ?? [])
    .filter((a) => a.side === 'red' && a.ai_score !== null)
    .map((a) => a.ai_score as number)

  const forAvg = avgOrNull(forScores)
  const againstAvg = avgOrNull(againstScores)

  let qualitySignal: ModelResponse['argument_quality']['quality_signal'] = 'no_data'
  if (forAvg !== null && againstAvg !== null) {
    const diff = forAvg - againstAvg
    if (diff > 5) qualitySignal = 'for_leads'
    else if (diff < -5) qualitySignal = 'against_leads'
    else qualitySignal = 'balanced'
  } else if (forAvg !== null) {
    qualitySignal = 'for_leads'
  } else if (againstAvg !== null) {
    qualitySignal = 'against_leads'
  }

  // ── 5. Volume signal ─────────────────────────────────────────────────────
  const votes = topic.total_votes ?? 0
  const volumeSignal: ModelResponse['volume_signal'] =
    votes >= 1000 ? 'high' : votes >= 100 ? 'medium' : 'low'

  // ── 6. Fair value model ───────────────────────────────────────────────────
  //
  // Components and weights:
  //   A) Market consensus (current price)             — 40%
  //   B) Forecaster weighted average target           — 30%
  //   C) Category benchmark                           — 15%
  //   D) Argument quality adjustment                  — 10%
  //   E) Category law rate signal                     — 5%
  //
  // When data is missing, weight is redistributed to A.

  let fairValue = currentPrice  // fallback

  const factors: ModelFactor[] = []

  // A — Market consensus
  const weightA = 40
  const valueA = currentPrice
  factors.push({
    name: 'Market Consensus',
    weight: weightA,
    value: valueA,
    impact: valueA >= 50 ? 'positive' : 'negative',
    description: `Current community vote split: ${Math.round(valueA)}% FOR`,
  })

  // B — Forecaster target
  let weightB = 0
  if (weightedTarget !== null && fcCount >= 3) {
    weightB = 30
    factors.push({
      name: 'Forecaster Target',
      weight: weightB,
      value: Math.round(weightedTarget),
      impact: weightedTarget >= currentPrice ? 'positive' : 'negative',
      description: `Weighted average of ${fcCount} forecaster price targets, confidence-adjusted`,
    })
  }

  // C — Category benchmark
  let weightC = 0
  if (categoryAvg !== null && categoryPrices.length >= 5) {
    weightC = 15
    factors.push({
      name: 'Category Benchmark',
      weight: weightC,
      value: Math.round(categoryAvg),
      impact: categoryAvg >= 50 ? 'positive' : 'negative',
      description: `${topic.category} category average consensus: ${Math.round(categoryAvg)}%`,
    })
  }

  // D — Argument quality
  let weightD = 0
  let argQualityValue = 50
  if (forAvg !== null || againstAvg !== null) {
    weightD = 10
    if (forAvg !== null && againstAvg !== null) {
      const diff = forAvg - againstAvg
      argQualityValue = clamp(50 + diff * 2, 0, 100)
    } else if (forAvg !== null) {
      argQualityValue = clamp(50 + (forAvg - 50) * 0.5, 0, 100)
    } else if (againstAvg !== null) {
      argQualityValue = clamp(50 - (againstAvg - 50) * 0.5, 0, 100)
    }
    factors.push({
      name: 'Argument Quality',
      weight: weightD,
      value: Math.round(argQualityValue),
      impact: qualitySignal === 'for_leads' ? 'positive' : qualitySignal === 'against_leads' ? 'negative' : 'neutral',
      description: `FOR argument quality vs AGAINST quality differential (AI-scored)`,
    })
  }

  // E — Category law rate
  let weightE = 0
  if (categoryLawRate !== null && allInCategory.length >= 10) {
    weightE = 5
    factors.push({
      name: 'Category Law Rate',
      weight: weightE,
      value: Math.round(categoryLawRate),
      impact: categoryLawRate >= 30 ? 'positive' : categoryLawRate >= 15 ? 'neutral' : 'negative',
      description: `${Math.round(categoryLawRate)}% of ${topic.category} debates become law`,
    })
  }

  // Redistribute missing weights to A
  const usedWeight = weightA + weightB + weightC + weightD + weightE
  const redistributed = 100 - usedWeight
  // Recalculate with actual weights
  const totalWeight = weightA + redistributed + weightB + weightC + weightD + weightE

  fairValue = (
    (valueA * (weightA + redistributed)) +
    (weightedTarget !== null && weightB > 0 ? Math.round(weightedTarget) * weightB : 0) +
    (categoryAvg !== null && weightC > 0 ? Math.round(categoryAvg) * weightC : 0) +
    (weightD > 0 ? argQualityValue * weightD : 0) +
    (categoryLawRate !== null && weightE > 0 ? categoryLawRate * weightE : 0)
  ) / totalWeight

  fairValue = Math.round(clamp(fairValue, 1, 99))

  // ── 7. Verdict ────────────────────────────────────────────────────────────
  const diff = currentPrice - fairValue
  const absDiff = Math.abs(diff)

  let verdict: ModelResponse['verdict']
  let verdictStrength: ModelResponse['verdict_strength']

  if (absDiff <= 2) {
    verdict = 'fairly_valued'
    verdictStrength = 'slight'
  } else if (diff > 0) {
    // Current price > fair value → overvalued (market consensus is higher than model)
    verdict = 'overvalued'
    verdictStrength = absDiff >= 15 ? 'strong' : absDiff >= 7 ? 'moderate' : 'slight'
  } else {
    verdict = 'undervalued'
    verdictStrength = absDiff >= 15 ? 'strong' : absDiff >= 7 ? 'moderate' : 'slight'
  }

  // Model confidence based on data quality
  const modelConfidence = Math.round(
    clamp(
      30 +
      (fcCount >= 10 ? 20 : fcCount >= 3 ? 10 : 0) +
      (votes >= 1000 ? 20 : votes >= 100 ? 10 : 0) +
      (categoryPrices.length >= 10 ? 15 : categoryPrices.length >= 5 ? 8 : 0) +
      ((forScores.length + againstScores.length) >= 10 ? 15 : (forScores.length + againstScores.length) >= 3 ? 8 : 0),
      0, 100,
    ),
  )

  return NextResponse.json({
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    current_price: currentPrice,
    fair_value: fairValue,
    verdict,
    verdict_strength: verdictStrength,
    confidence: modelConfidence,
    factors,
    benchmarks: {
      category_avg: categoryAvg !== null ? Math.round(categoryAvg) : null,
      category_law_rate: categoryLawRate !== null ? Math.round(categoryLawRate) : null,
      similar_avg: similarAvg !== null ? Math.round(similarAvg) : null,
    },
    forecaster: {
      count: fcCount,
      avg_target: weightedTarget !== null ? Math.round(weightedTarget) : null,
      bullish_pct: Math.round(bullishPct),
      bearish_pct: Math.round(bearishPct),
      neutral_pct: Math.round(neutralPct),
      avg_confidence: Math.round(avgConfidence),
    },
    argument_quality: {
      for_avg: forAvg !== null ? Math.round(forAvg) : null,
      against_avg: againstAvg !== null ? Math.round(againstAvg) : null,
      quality_signal: qualitySignal,
    },
    volume_signal: volumeSignal,
  } satisfies ModelResponse)
}
