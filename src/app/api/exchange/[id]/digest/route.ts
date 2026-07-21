import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DigestArgument {
  id: string
  body: string
  side: 'for' | 'against'
  upvote_count: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  created_at: string
}

export interface DigestCommentary {
  id: string
  content: string
  direction: 'for' | 'against' | 'neutral' | null
  likes: number
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface DigestForecast {
  target_price: number
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  reasoning: string | null
  username: string
  display_name: string | null
}

export interface DigestPriceTick {
  ts: string
  price: number
}

export interface WeeklyDigest {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number

  // 7-day stats
  price_7d_ago: number | null
  price_change_7d: number | null
  volume_7d: number
  volume_7d_change_pct: number | null

  // 14-day price ticks for the mini chart
  price_ticks: DigestPriceTick[]

  // New this week (added in last 7 days)
  new_for_args: DigestArgument[]
  new_against_args: DigestArgument[]

  // Top commentary this week
  top_commentary: DigestCommentary[]

  // Forecaster consensus
  forecast_count: number
  median_target: number | null
  bullish_pct: number
  bearish_pct: number
  neutral_pct: number
  top_forecasts: DigestForecast[]

  // Signals
  is_hot: boolean
  is_near_law: boolean
  is_deadlocked: boolean
  is_overbought: boolean

  generated_at: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Core topic ─────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  const price = Math.round(topic.blue_pct ?? 50)
  const volume = topic.total_votes ?? 0
  const nowMs = Date.now()
  const ms7d  = 7  * 24 * 60 * 60 * 1000
  const ms14d = 14 * 24 * 60 * 60 * 1000
  const cutoff7d      = new Date(nowMs - ms7d).toISOString()
  const cutoff14d     = new Date(nowMs - ms14d).toISOString()
  const cutoff14dPrev = new Date(nowMs - ms14d * 2).toISOString()

  // ── 2. Price history (14 days for chart) ──────────────────────────────────
  const { data: priceRows } = await supabase
    .from('topic_price_history')
    .select('recorded_at, price')
    .eq('topic_id', id)
    .gte('recorded_at', cutoff14d)
    .order('recorded_at', { ascending: true })

  const ticks: DigestPriceTick[] = (priceRows ?? []).map((r) => ({
    ts: r.recorded_at as string,
    price: Math.round(r.price ?? 50),
  }))

  // Price 7 days ago
  const { data: oldPriceRow } = await supabase
    .from('topic_price_history')
    .select('price')
    .eq('topic_id', id)
    .lte('recorded_at', cutoff7d)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const price7dAgo = oldPriceRow ? Math.round(oldPriceRow.price ?? 50) : null
  const priceChange7d = price7dAgo !== null ? price - price7dAgo : null

  // ── 3. Weekly vote volume ─────────────────────────────────────────────────
  const { count: votes7d } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', id)
    .gte('created_at', cutoff7d)

  const { count: votesPrev7d } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', id)
    .gte('created_at', cutoff14dPrev)
    .lt('created_at', cutoff7d)

  const volume7d = votes7d ?? 0
  const volumePrev7d = votesPrev7d ?? 0
  const volume7dChangePct =
    volumePrev7d > 0 ? Math.round(((volume7d - volumePrev7d) / volumePrev7d) * 100) : null

  // ── 4. New arguments this week ────────────────────────────────────────────
  const { data: newArgs } = await supabase
    .from('arguments')
    .select(`
      id, body, side, upvote_count, created_at,
      profiles:user_id ( username, display_name, avatar_url )
    `)
    .eq('topic_id', id)
    .gte('created_at', cutoff7d)
    .order('upvote_count', { ascending: false })
    .limit(10)

  const allNewArgs: DigestArgument[] = (newArgs ?? []).map((a) => {
    const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    return {
      id: a.id,
      body: a.body,
      side: (a.side as 'for' | 'against') ?? 'for',
      upvote_count: a.upvote_count ?? 0,
      author_username: (p as { username?: string })?.username ?? 'unknown',
      author_display_name: (p as { display_name?: string | null })?.display_name ?? null,
      author_avatar_url: (p as { avatar_url?: string | null })?.avatar_url ?? null,
      created_at: a.created_at as string,
    }
  })

  const newForArgs     = allNewArgs.filter((a) => a.side === 'for').slice(0, 3)
  const newAgainstArgs = allNewArgs.filter((a) => a.side === 'against').slice(0, 3)

  // ── 5. Top commentary this week ───────────────────────────────────────────
  const { data: commentaryRows } = await supabase
    .from('market_commentary')
    .select(`
      id, content, direction, likes, created_at,
      profiles:user_id ( username, display_name, avatar_url )
    `)
    .eq('topic_id', id)
    .gte('created_at', cutoff7d)
    .order('likes', { ascending: false })
    .limit(5)

  const topCommentary: DigestCommentary[] = (commentaryRows ?? []).map((c) => {
    const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
    return {
      id: c.id,
      content: c.content,
      direction: c.direction as 'for' | 'against' | 'neutral' | null,
      likes: c.likes ?? 0,
      username: (p as { username?: string })?.username ?? 'unknown',
      display_name: (p as { display_name?: string | null })?.display_name ?? null,
      avatar_url: (p as { avatar_url?: string | null })?.avatar_url ?? null,
      created_at: c.created_at as string,
    }
  })

  // ── 6. Forecasts ──────────────────────────────────────────────────────────
  const { data: forecastRows } = await supabase
    .from('exchange_forecasts')
    .select(`
      target_price, direction, confidence, reasoning,
      profiles:user_id ( username, display_name )
    `)
    .eq('topic_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const forecasts = forecastRows ?? []
  const fCount  = forecasts.length
  const bullish = forecasts.filter((f) => f.direction === 'bullish').length
  const bearish = forecasts.filter((f) => f.direction === 'bearish').length
  const neutral = forecasts.filter((f) => f.direction === 'neutral').length

  const targets = forecasts.map((f) => f.target_price).sort((a, b) => a - b)
  const medianTarget = targets.length > 0
    ? targets.length % 2 === 0
      ? Math.round((targets[targets.length / 2 - 1] + targets[targets.length / 2]) / 2)
      : targets[Math.floor(targets.length / 2)]
    : null

  const topForecasts: DigestForecast[] = forecasts.slice(0, 3).map((f) => {
    const p = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles
    return {
      target_price: f.target_price,
      direction: f.direction as 'bullish' | 'bearish' | 'neutral',
      confidence: f.confidence,
      reasoning: f.reasoning ?? null,
      username: (p as { username?: string })?.username ?? 'unknown',
      display_name: (p as { display_name?: string | null })?.display_name ?? null,
    }
  })

  // ── 7. Signals ────────────────────────────────────────────────────────────
  const isHot       = (topic.feed_score ?? 0) > 50
  const isNearLaw   = price >= 75
  const isDeadlocked = price >= 45 && price <= 55
  const isOverbought = price >= 80

  const digest: WeeklyDigest = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    price,
    volume,
    price_7d_ago: price7dAgo,
    price_change_7d: priceChange7d,
    volume_7d: volume7d,
    volume_7d_change_pct: volume7dChangePct,
    price_ticks: ticks,
    new_for_args: newForArgs,
    new_against_args: newAgainstArgs,
    top_commentary: topCommentary,
    forecast_count: fCount,
    median_target: medianTarget,
    bullish_pct: fCount > 0 ? Math.round((bullish / fCount) * 100) : 0,
    bearish_pct: fCount > 0 ? Math.round((bearish / fCount) * 100) : 0,
    neutral_pct: fCount > 0 ? Math.round((neutral / fCount) * 100) : 0,
    top_forecasts: topForecasts,
    is_hot: isHot,
    is_near_law: isNearLaw,
    is_deadlocked: isDeadlocked,
    is_overbought: isOverbought,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(digest)
}
