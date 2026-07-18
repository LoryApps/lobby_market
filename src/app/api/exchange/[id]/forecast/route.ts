import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastEntry {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  target_price: number
  reasoning: string | null
  horizon: '7d' | '14d' | '30d' | '90d' | '180d'
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  created_at: string
  updated_at: string
}

export interface ForecastStats {
  count: number
  median_target: number
  mean_target: number
  bullish_pct: number
  bearish_pct: number
  neutral_pct: number
  high_confidence_median: number | null
  distribution: {
    bucket: string    // e.g. "0-10", "10-20", …
    min: number
    max: number
    count: number
  }[]
}

export interface ForecastResponse {
  stats: ForecastStats
  forecasts: ForecastEntry[]
  my_forecast: ForecastEntry | null
  current_price: number
  statement: string
}

// ─── GET /api/exchange/[id]/forecast ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch topic basics
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, blue_pct, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const currentPrice = Math.round(topic.blue_pct ?? 50)

  // Current user (optional)
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all forecasts with profile join
  const { data: rawForecasts } = await supabase
    .from('exchange_forecasts')
    .select(`
      id,
      user_id,
      target_price,
      reasoning,
      horizon,
      direction,
      confidence,
      created_at,
      updated_at,
      profiles!exchange_forecasts_user_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('topic_id', params.id)
    .order('confidence', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  const forecasts: ForecastEntry[] = (rawForecasts ?? []).map((f) => {
    const profile = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles
    return {
      id: f.id,
      user_id: f.user_id,
      username: (profile as { username: string })?.username ?? 'unknown',
      display_name: (profile as { display_name: string | null })?.display_name ?? null,
      avatar_url: (profile as { avatar_url: string | null })?.avatar_url ?? null,
      target_price: f.target_price,
      reasoning: f.reasoning,
      horizon: f.horizon as ForecastEntry['horizon'],
      direction: f.direction as ForecastEntry['direction'],
      confidence: f.confidence,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }
  })

  // Compute stats
  const BUCKETS = [
    { min: 0,  max: 10,  bucket: '0-10'  },
    { min: 10, max: 20,  bucket: '10-20' },
    { min: 20, max: 30,  bucket: '20-30' },
    { min: 30, max: 40,  bucket: '30-40' },
    { min: 40, max: 50,  bucket: '40-50' },
    { min: 50, max: 60,  bucket: '50-60' },
    { min: 60, max: 70,  bucket: '60-70' },
    { min: 70, max: 80,  bucket: '70-80' },
    { min: 80, max: 90,  bucket: '80-90' },
    { min: 90, max: 101, bucket: '90-100' },
  ]

  const prices = forecasts.map((f) => f.target_price)
  const sorted = [...prices].sort((a, b) => a - b)
  const n = sorted.length

  function median(arr: number[]): number {
    if (arr.length === 0) return currentPrice
    const mid = Math.floor(arr.length / 2)
    return arr.length % 2 === 0
      ? Math.round((arr[mid - 1] + arr[mid]) / 2)
      : arr[mid]
  }

  const bullish = forecasts.filter((f) => f.direction === 'bullish').length
  const bearish = forecasts.filter((f) => f.direction === 'bearish').length
  const neutral = forecasts.filter((f) => f.direction === 'neutral').length

  const highConf = forecasts.filter((f) => f.confidence >= 4).map((f) => f.target_price)
  const highConfSorted = [...highConf].sort((a, b) => a - b)

  const stats: ForecastStats = {
    count: n,
    median_target: median(sorted),
    mean_target: n > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / n) : currentPrice,
    bullish_pct: n > 0 ? Math.round((bullish / n) * 100) : 0,
    bearish_pct: n > 0 ? Math.round((bearish / n) * 100) : 0,
    neutral_pct: n > 0 ? Math.round((neutral / n) * 100) : 0,
    high_confidence_median: highConfSorted.length > 0 ? median(highConfSorted) : null,
    distribution: BUCKETS.map((b) => ({
      ...b,
      count: prices.filter((p) => p >= b.min && p < b.max).length,
    })),
  }

  // My forecast
  const myForecast = user
    ? (forecasts.find((f) => f.user_id === user.id) ?? null)
    : null

  return NextResponse.json({
    stats,
    forecasts,
    my_forecast: myForecast,
    current_price: currentPrice,
    statement: topic.statement,
  } satisfies ForecastResponse)
}

// ─── POST /api/exchange/[id]/forecast — submit or update a forecast ───────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { target_price, reasoning, horizon, direction, confidence } = body

  if (
    typeof target_price !== 'number' ||
    target_price < 0 ||
    target_price > 100 ||
    !['7d', '14d', '30d', '90d', '180d'].includes(horizon) ||
    !['bullish', 'bearish', 'neutral'].includes(direction) ||
    typeof confidence !== 'number' ||
    confidence < 1 ||
    confidence > 5
  ) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { error } = await supabase
    .from('exchange_forecasts')
    .upsert(
      {
        topic_id: params.id,
        user_id: user.id,
        target_price: Math.round(target_price),
        reasoning: reasoning?.slice(0, 500) || null,
        horizon,
        direction,
        confidence,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'topic_id,user_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE /api/exchange/[id]/forecast — remove own forecast ─────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('exchange_forecasts')
    .delete()
    .eq('topic_id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
