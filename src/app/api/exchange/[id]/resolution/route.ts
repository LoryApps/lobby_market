import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MandateStrength = 'narrow' | 'moderate' | 'strong' | 'landslide'

export interface TopForecaster {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  forecast_target: number
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  error: number
  direction_correct: boolean | null
  forecast_age_days: number
}

export interface PriceSnapshot {
  recorded_at: string
  price: number
  volume: number
}

export interface ResolutionData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    final_price: number
    total_votes: number
    blue_votes: number
    red_votes: number
    created_at: string
    resolution_at: string | null
  }

  is_resolved: boolean

  crowd: {
    crowd_was_right: boolean | null
    correct_votes: number
    incorrect_votes: number
    accuracy_pct: number | null
    brier_score: number | null
    mandate_strength: MandateStrength
    mandate_label: string
  }

  top_forecasters: TopForecaster[]
  forecast_stats: {
    total: number
    median_target: number | null
    bullish_count: number
    bearish_count: number
    neutral_count: number
    forecasters_correct: number | null
    forecast_accuracy_pct: number | null
  }

  price_history: PriceSnapshot[]

  lifecycle: {
    days_active: number
    peak_price: number | null
    trough_price: number | null
    price_range: number | null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMandateStrength(finalPrice: number, outcome: string): MandateStrength {
  if (outcome !== 'law' && outcome !== 'failed') return 'narrow'
  const margin = outcome === 'law' ? finalPrice - 50 : 50 - finalPrice
  if (margin >= 35) return 'landslide'
  if (margin >= 20) return 'strong'
  if (margin >= 10) return 'moderate'
  return 'narrow'
}

function getMandateLabel(finalPrice: number, outcome: string): string {
  const strength = getMandateStrength(finalPrice, outcome)
  const isLaw = outcome === 'law'

  if (isLaw) {
    if (strength === 'landslide') return 'Passed by landslide'
    if (strength === 'strong')    return 'Passed with strong mandate'
    if (strength === 'moderate')  return 'Passed with moderate support'
    return 'Passed narrowly'
  } else {
    if (strength === 'landslide') return 'Rejected decisively'
    if (strength === 'strong')    return 'Rejected with strong opposition'
    if (strength === 'moderate')  return 'Rejected with moderate opposition'
    return 'Rejected narrowly'
  }
}

function brierScore(forecasts: { target_price: number }[], outcome: 0 | 1): number {
  if (!forecasts.length) return 0
  const sum = forecasts.reduce((acc, f) => {
    const prob = f.target_price / 100
    return acc + Math.pow(prob - outcome, 2)
  }, 0)
  return Math.round((sum / forecasts.length) * 1000) / 1000
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, created_at, updated_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isResolved = topic.status === 'law' || topic.status === 'failed'
  const finalPrice = Math.round(topic.blue_pct ?? 50)

  // Resolution timestamp: use updated_at as proxy for when status changed
  const resolutionAt = isResolved ? topic.updated_at : null

  // ── 2. Crowd accuracy ─────────────────────────────────────────────────────
  const blueVotes = topic.blue_votes ?? 0
  const redVotes  = topic.red_votes ?? 0
  const totalVotes = topic.total_votes ?? (blueVotes + redVotes)

  let correctVotes = 0
  let incorrectVotes = 0
  let crowdWasRight: boolean | null = null

  if (isResolved) {
    if (topic.status === 'law') {
      correctVotes = blueVotes
      incorrectVotes = redVotes
      crowdWasRight = finalPrice >= 50
    } else {
      correctVotes = redVotes
      incorrectVotes = blueVotes
      crowdWasRight = finalPrice < 50
    }
  }

  const accuracyPct =
    isResolved && totalVotes > 0
      ? Math.round((correctVotes / totalVotes) * 100)
      : null

  // ── 3. Forecasts ──────────────────────────────────────────────────────────
  const { data: forecastRows } = await supabase
    .from('exchange_forecasts')
    .select(`
      id,
      user_id,
      target_price,
      direction,
      confidence,
      reasoning,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role,
        clout
      )
    `)
    .eq('topic_id', id)
    .order('confidence', { ascending: false })
    .limit(100)

  const forecasts = (forecastRows ?? []).filter(
    (f): f is typeof f & { profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number } } =>
      !!f.profiles && typeof (f.profiles as Record<string, unknown>).username === 'string'
  )

  // Score each forecast against the resolution
  const outcome: 0 | 1 = topic.status === 'law' ? 1 : 0

  const brierScoreVal = isResolved
    ? brierScore(forecasts, outcome)
    : null

  const medianTarget = median(forecasts.map((f) => f.target_price))

  let bullishCount = 0
  let bearishCount = 0
  let neutralCount = 0
  let forecastersCorrect = 0

  const topForecasters: TopForecaster[] = forecasts
    .map((f) => {
      const profile = f.profiles as { username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number }
      const error = Math.abs(f.target_price - finalPrice)

      let directionCorrect: boolean | null = null
      if (isResolved) {
        if (topic.status === 'law')   directionCorrect = f.direction === 'bullish'
        if (topic.status === 'failed') directionCorrect = f.direction === 'bearish'
      }

      if (f.direction === 'bullish') bullishCount++
      else if (f.direction === 'bearish') bearishCount++
      else neutralCount++

      if (directionCorrect) forecastersCorrect++

      const forecastAgeDays = Math.floor(
        (Date.now() - new Date(f.created_at).getTime()) / 86_400_000
      )

      return {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout ?? 0,
        forecast_target: f.target_price,
        direction: f.direction as 'bullish' | 'bearish' | 'neutral',
        confidence: f.confidence,
        error,
        direction_correct: directionCorrect,
        forecast_age_days: forecastAgeDays,
      }
    })
    .sort((a, b) => {
      // Primary sort: direction correct (resolved) or confidence (active)
      if (isResolved) {
        if (a.direction_correct && !b.direction_correct) return -1
        if (!a.direction_correct && b.direction_correct) return 1
        return a.error - b.error
      }
      return b.confidence - a.confidence
    })
    .slice(0, 10)

  const forecastAccuracyPct =
    isResolved && forecasts.length > 0
      ? Math.round((forecastersCorrect / forecasts.length) * 100)
      : null

  // ── 4. Price history ──────────────────────────────────────────────────────
  const { data: snapshots } = await supabase
    .from('topic_price_history')
    .select('recorded_at, price, volume')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(120)

  const priceHistory: PriceSnapshot[] = (snapshots ?? []).map((s) => ({
    recorded_at: s.recorded_at,
    price: Math.round(s.price),
    volume: s.volume,
  }))

  // ── 5. Lifecycle metrics ──────────────────────────────────────────────────
  const createdAt = new Date(topic.created_at)
  const resolvedAt = resolutionAt ? new Date(resolutionAt) : new Date()
  const daysActive = Math.max(
    0,
    Math.floor((resolvedAt.getTime() - createdAt.getTime()) / 86_400_000)
  )

  const prices = priceHistory.map((s) => s.price)
  const peakPrice = prices.length ? Math.max(...prices) : null
  const troughPrice = prices.length ? Math.min(...prices) : null
  const priceRange =
    peakPrice !== null && troughPrice !== null
      ? Math.round(peakPrice - troughPrice)
      : null

  // ── 6. Assemble response ──────────────────────────────────────────────────
  const data: ResolutionData = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      final_price: finalPrice,
      total_votes: totalVotes,
      blue_votes: blueVotes,
      red_votes: redVotes,
      created_at: topic.created_at,
      resolution_at: resolutionAt,
    },

    is_resolved: isResolved,

    crowd: {
      crowd_was_right: crowdWasRight,
      correct_votes: correctVotes,
      incorrect_votes: incorrectVotes,
      accuracy_pct: accuracyPct,
      brier_score: brierScoreVal,
      mandate_strength: getMandateStrength(finalPrice, topic.status),
      mandate_label: getMandateLabel(finalPrice, topic.status),
    },

    top_forecasters: topForecasters,
    forecast_stats: {
      total: forecasts.length,
      median_target: medianTarget !== null ? Math.round(medianTarget) : null,
      bullish_count: bullishCount,
      bearish_count: bearishCount,
      neutral_count: neutralCount,
      forecasters_correct: isResolved ? forecastersCorrect : null,
      forecast_accuracy_pct: forecastAccuracyPct,
    },

    price_history: priceHistory,

    lifecycle: {
      days_active: daysActive,
      peak_price: peakPrice !== null ? Math.round(peakPrice) : null,
      trough_price: troughPrice !== null ? Math.round(troughPrice) : null,
      price_range: priceRange,
    },
  }

  return NextResponse.json(data)
}
