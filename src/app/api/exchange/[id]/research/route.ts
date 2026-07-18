import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResearchArgument {
  id: string
  body: string
  side: 'for' | 'against'
  score: number
  username: string
  display_name: string | null
}

export interface ResearchForecast {
  username: string
  display_name: string | null
  target_price: number
  direction: 'bullish' | 'bearish' | 'neutral'
  confidence: number
  reasoning: string | null
}

export interface ResearchCommentary {
  id: string
  content: string
  direction: 'for' | 'against' | 'neutral' | null
  likes: number
  username: string
  display_name: string | null
}

export interface ResearchThesis {
  id: string
  title: string
  body: string
  direction: 'for' | 'against' | 'neutral'
  upvotes: number
  confidence: number
  username: string
  display_name: string | null
}

export interface PriceTick {
  ts: string
  price: number
}

export interface MarketResearch {
  // Core market
  id: string
  statement: string
  category: string | null
  scope: string | null
  status: string
  price: number
  volume: number
  created_at: string

  // Price movement
  price_7d_ago: number | null
  price_30d_ago: number | null
  price_all_time_high: number
  price_all_time_low: number
  price_ticks: PriceTick[]
  momentum_7d: number | null
  momentum_30d: number | null
  trend: 'bullish' | 'bearish' | 'neutral'

  // Signals
  is_hot: boolean
  is_near_law: boolean
  is_deadlocked: boolean
  is_closing_soon: boolean
  is_overbought: boolean
  is_oversold: boolean
  volatility_score: number

  // Arguments
  top_for_args: ResearchArgument[]
  top_against_args: ResearchArgument[]
  for_arg_count: number
  against_arg_count: number

  // Forecasts
  forecast_count: number
  median_target: number | null
  bullish_pct: number
  bearish_pct: number
  neutral_pct: number
  top_forecasts: ResearchForecast[]

  // Ideas / Theses
  top_theses: ResearchThesis[]

  // Commentary
  recent_commentary: ResearchCommentary[]

  // Analyst meta
  generated_at: string
}

// ─── GET /api/exchange/[id]/research ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // ── 1. Core topic ──────────────────────────────────────────────────────────
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, scope, status, blue_pct, total_votes, feed_score, view_count, created_at, voting_ends_at')
      .eq('id', id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const price = Math.round(topic.blue_pct ?? 50)
    const volume = topic.total_votes ?? 0

    // ── 2. Price history ───────────────────────────────────────────────────────
    const { data: priceRows } = await supabase
      .from('topic_price_history')
      .select('recorded_at, price')
      .eq('topic_id', id)
      .order('recorded_at', { ascending: true })
      .limit(60)

    const ticks: PriceTick[] = (priceRows ?? []).map((r) => ({
      ts: r.recorded_at as string,
      price: Math.round((r.price ?? 50) * 100),
    }))

    const nowMs = Date.now()
    const ms7d  = 7  * 24 * 60 * 60 * 1000
    const ms30d = 30 * 24 * 60 * 60 * 1000

    function tickAtAge(ageMs: number): number | null {
      const cutoff = nowMs - ageMs
      const older = ticks.filter((t) => new Date(t.ts).getTime() <= cutoff)
      return older.length > 0 ? older[older.length - 1].price : null
    }

    const price7dAgo  = tickAtAge(ms7d)
    const price30dAgo = tickAtAge(ms30d)
    const prices = ticks.map((t) => t.price)
    const allTimeHigh = prices.length > 0 ? Math.max(...prices) : price
    const allTimeLow  = prices.length > 0 ? Math.min(...prices) : price

    const momentum7d  = price7dAgo  != null ? price - price7dAgo  : null
    const momentum30d = price30dAgo != null ? price - price30dAgo : null

    // Simple trend: compare to 7d ago or 30d ago
    const recentChange = momentum7d ?? momentum30d ?? 0
    const trend: 'bullish' | 'bearish' | 'neutral' =
      recentChange > 2 ? 'bullish' : recentChange < -2 ? 'bearish' : 'neutral'

    // Volatility: std dev of price ticks
    let volatilityScore = 0
    if (prices.length >= 2) {
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length
      const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length
      volatilityScore = Math.min(100, Math.round(Math.sqrt(variance) * 2))
    }

    // ── 3. Signals ─────────────────────────────────────────────────────────────
    const isNearLaw     = price >= 67 && topic.status === 'active'
    const isDeadlocked  = price >= 45 && price <= 55 && volume > 20
    const isOverbought  = price >= 80
    const isOversold    = price <= 20
    const isHot         = (topic.feed_score ?? 0) > 50
    const isClosingSoon = topic.voting_ends_at
      ? new Date(topic.voting_ends_at).getTime() - nowMs < 48 * 60 * 60 * 1000
      : false

    // ── 4. Top arguments ───────────────────────────────────────────────────────
    const { data: argRows } = await supabase
      .from('arguments')
      .select(`
        id,
        body,
        side,
        upvotes,
        downvotes,
        author:profiles!arguments_author_id_fkey (username, display_name)
      `)
      .eq('topic_id', id)
      .order('upvotes', { ascending: false })
      .limit(10)

    const allArgs = (argRows ?? []) as Array<{
      id: string
      body: string
      side: string
      upvotes: number
      downvotes: number
      author: { username: string; display_name: string | null } | null
    }>

    function toResArg(a: typeof allArgs[0]): ResearchArgument {
      return {
        id: a.id,
        body: a.body.slice(0, 300),
        side: a.side as 'for' | 'against',
        score: a.upvotes - a.downvotes,
        username: a.author?.username ?? 'anonymous',
        display_name: a.author?.display_name ?? null,
      }
    }

    const topForArgs     = allArgs.filter((a) => a.side === 'for').slice(0, 3).map(toResArg)
    const topAgainstArgs = allArgs.filter((a) => a.side === 'against').slice(0, 3).map(toResArg)
    const forCount       = allArgs.filter((a) => a.side === 'for').length
    const againstCount   = allArgs.filter((a) => a.side === 'against').length

    // ── 5. Forecasts ───────────────────────────────────────────────────────────
    const { data: fcastRows } = await supabase
      .from('exchange_forecasts')
      .select(`
        target_price,
        direction,
        confidence,
        reasoning,
        forecaster:profiles!exchange_forecasts_user_id_fkey(username, display_name)
      `)
      .eq('topic_id', id)
      .order('confidence', { ascending: false })
      .limit(20)

    const fcasts = (fcastRows ?? []) as Array<{
      target_price: number
      direction: string
      confidence: number
      reasoning: string | null
      forecaster: { username: string; display_name: string | null } | null
    }>

    const forecastCount = fcasts.length
    const targets = fcasts.map((f) => f.target_price ?? 50)
    const medianTarget = targets.length > 0
      ? targets.sort((a, b) => a - b)[Math.floor(targets.length / 2)]
      : null
    const bullishPct = forecastCount > 0
      ? Math.round(fcasts.filter((f) => f.direction === 'bullish').length / forecastCount * 100)
      : 0
    const bearishPct = forecastCount > 0
      ? Math.round(fcasts.filter((f) => f.direction === 'bearish').length / forecastCount * 100)
      : 0
    const neutralPct = 100 - bullishPct - bearishPct

    const topForecasts: ResearchForecast[] = fcasts.slice(0, 3).map((f) => ({
      username: f.forecaster?.username ?? 'anonymous',
      display_name: f.forecaster?.display_name ?? null,
      target_price: f.target_price,
      direction: f.direction as 'bullish' | 'bearish' | 'neutral',
      confidence: f.confidence,
      reasoning: f.reasoning,
    }))

    // ── 6. Theses / Ideas ──────────────────────────────────────────────────────
    const { data: ideaRows } = await supabase
      .from('market_ideas')
      .select(`
        id,
        title,
        body,
        direction,
        upvotes,
        confidence,
        author:profiles!user_id(username, display_name)
      `)
      .eq('topic_id', id)
      .order('upvotes', { ascending: false })
      .limit(3)

    const topTheses: ResearchThesis[] = (ideaRows ?? []).map((i: {
      id: string
      title: string
      body: string
      direction: string
      upvotes: number
      confidence: number
      author: { username: string; display_name: string | null } | null
    }) => ({
      id: i.id,
      title: i.title,
      body: (i.body ?? '').slice(0, 300),
      direction: i.direction as 'for' | 'against' | 'neutral',
      upvotes: i.upvotes ?? 0,
      confidence: i.confidence ?? 50,
      username: i.author?.username ?? 'anonymous',
      display_name: i.author?.display_name ?? null,
    }))

    // ── 7. Recent Commentary ───────────────────────────────────────────────────
    const { data: commentRows } = await supabase
      .from('market_commentary')
      .select(`
        id,
        content,
        direction,
        likes,
        author:profiles!user_id(username, display_name)
      `)
      .eq('topic_id', id)
      .order('likes', { ascending: false })
      .limit(3)

    const recentCommentary: ResearchCommentary[] = (commentRows ?? []).map((c: {
      id: string
      content: string
      direction: string | null
      likes: number
      author: { username: string; display_name: string | null } | null
    }) => ({
      id: c.id,
      content: c.content.slice(0, 200),
      direction: (c.direction ?? null) as 'for' | 'against' | 'neutral' | null,
      likes: c.likes ?? 0,
      username: c.author?.username ?? 'anonymous',
      display_name: c.author?.display_name ?? null,
    }))

    // ── 8. Assemble ────────────────────────────────────────────────────────────
    const research: MarketResearch = {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      scope: topic.scope ?? null,
      status: topic.status,
      price,
      volume,
      created_at: topic.created_at,
      price_7d_ago: price7dAgo,
      price_30d_ago: price30dAgo,
      price_all_time_high: allTimeHigh,
      price_all_time_low: allTimeLow,
      price_ticks: ticks,
      momentum_7d: momentum7d,
      momentum_30d: momentum30d,
      trend,
      is_hot: isHot,
      is_near_law: isNearLaw,
      is_deadlocked: isDeadlocked,
      is_closing_soon: isClosingSoon,
      is_overbought: isOverbought,
      is_oversold: isOversold,
      volatility_score: volatilityScore,
      top_for_args: topForArgs,
      top_against_args: topAgainstArgs,
      for_arg_count: forCount,
      against_arg_count: againstCount,
      forecast_count: forecastCount,
      median_target: medianTarget,
      bullish_pct: bullishPct,
      bearish_pct: bearishPct,
      neutral_pct: neutralPct,
      top_forecasts: topForecasts,
      top_theses: topTheses,
      recent_commentary: recentCommentary,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(research)
  } catch (err) {
    console.error('[/api/exchange/[id]/research]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
