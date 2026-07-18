import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MyForecast {
  id: string
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  target_price: number
  direction: 'bullish' | 'bearish' | 'neutral'
  horizon: '7d' | '14d' | '30d' | '90d' | '180d'
  confidence: number
  reasoning: string | null
  created_at: string
  updated_at: string
  // Derived
  delta: number           // target - current
  is_correct_direction: boolean
  pct_to_target: number   // abs(target - current)
  accuracy_score: number  // 0-100: how close current is to target (100 = exact)
}

export interface ForecastsStats {
  total: number
  bullish: number
  bearish: number
  neutral: number
  avg_confidence: number
  correct_direction: number
  correct_direction_pct: number
  avg_accuracy: number   // mean accuracy_score
  within_5c: number      // forecasts where |delta| <= 5
  within_10c: number
}

export interface ForecastsResponse {
  forecasts: MyForecast[]
  stats: ForecastsStats
  is_authenticated: boolean
}

// ─── GET /api/exchange/forecasts ─────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ forecasts: [], stats: null, is_authenticated: false } satisfies ForecastsResponse, { status: 200 })
  }

  // Fetch user's forecasts with topic data
  const { data: rawForecasts, error } = await supabase
    .from('exchange_forecasts')
    .select(`
      id,
      topic_id,
      target_price,
      direction,
      horizon,
      confidence,
      reasoning,
      created_at,
      updated_at,
      topics!exchange_forecasts_topic_id_fkey (
        statement,
        category,
        status,
        blue_pct
      )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const forecasts: MyForecast[] = (rawForecasts ?? []).map((f) => {
    const topic = Array.isArray(f.topics) ? f.topics[0] : f.topics
    const currentPrice = Math.round((topic as { blue_pct: number | null })?.blue_pct ?? 50)
    const delta = f.target_price - currentPrice
    const accuracyScore = Math.max(0, 100 - Math.abs(delta))

    const isCorrect =
      f.direction === 'neutral'
        ? Math.abs(delta) <= 5
        : f.direction === 'bullish'
        ? delta >= 0
        : delta <= 0

    return {
      id: f.id,
      topic_id: f.topic_id,
      statement: (topic as { statement: string })?.statement ?? '',
      category: (topic as { category: string | null })?.category ?? null,
      status: (topic as { status: string })?.status ?? 'active',
      current_price: currentPrice,
      target_price: f.target_price,
      direction: f.direction as MyForecast['direction'],
      horizon: f.horizon as MyForecast['horizon'],
      confidence: f.confidence,
      reasoning: f.reasoning,
      created_at: f.created_at,
      updated_at: f.updated_at,
      delta,
      is_correct_direction: isCorrect,
      pct_to_target: Math.abs(delta),
      accuracy_score: accuracyScore,
    }
  })

  // Stats
  const n = forecasts.length
  const bullish = forecasts.filter((f) => f.direction === 'bullish').length
  const bearish = forecasts.filter((f) => f.direction === 'bearish').length
  const neutral = forecasts.filter((f) => f.direction === 'neutral').length
  const correctDir = forecasts.filter((f) => f.is_correct_direction).length
  const avgConf = n > 0 ? forecasts.reduce((s, f) => s + f.confidence, 0) / n : 0
  const avgAcc = n > 0 ? forecasts.reduce((s, f) => s + f.accuracy_score, 0) / n : 0
  const within5 = forecasts.filter((f) => f.pct_to_target <= 5).length
  const within10 = forecasts.filter((f) => f.pct_to_target <= 10).length

  const stats: ForecastsStats = {
    total: n,
    bullish,
    bearish,
    neutral,
    avg_confidence: Math.round(avgConf * 10) / 10,
    correct_direction: correctDir,
    correct_direction_pct: n > 0 ? Math.round((correctDir / n) * 100) : 0,
    avg_accuracy: Math.round(avgAcc),
    within_5c: within5,
    within_10c: within10,
  }

  return NextResponse.json({ forecasts, stats, is_authenticated: true } satisfies ForecastsResponse)
}
