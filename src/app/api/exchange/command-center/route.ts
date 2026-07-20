import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CCWatchItem {
  topic_id: string
  statement: string
  category: string | null
  status: string
  price: number
  delta_24h: number | null
  volume: number
  added_at: string
  note: string | null
}

export interface CCAlert {
  id: string
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  threshold: number
  direction: 'above' | 'below'
  proximity_pct: number   // 0-100 how close current price is to threshold
  is_triggered: boolean
  created_at: string
}

export interface CCForecast {
  id: string
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  target_price: number
  direction: 'bullish' | 'bearish' | 'neutral'
  horizon: string
  confidence: number
  delta: number
  accuracy_score: number  // 0-100
  created_at: string
}

export interface CCPosition {
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  current_price: number
  status: string
  pnl: number
  outcome: 'winning' | 'losing' | 'settled_win' | 'settled_loss' | 'push'
  is_settled: boolean
  voted_at: string
}

export interface CCIdea {
  id: string
  topic_id: string | null
  statement: string | null
  category: string | null
  title: string
  direction: 'for' | 'against' | 'neutral'
  upvotes: number
  downvotes: number
  score: number
  created_at: string
}

export interface CommandCenterSummary {
  total_watched: number
  active_alerts: number
  total_forecasts: number
  open_positions: number
  settled_wins: number
  settled_losses: number
  win_rate: number | null
  avg_forecast_accuracy: number | null
  net_pnl: number
  alerts_near_threshold: number   // alerts within 5¢ of trigger
  forecasts_on_target: number     // forecasts within 5¢
  ideas_score: number             // total net upvotes on user's ideas
}

export interface CommandCenterResponse {
  summary: CommandCenterSummary
  watchlist: CCWatchItem[]
  alerts: CCAlert[]
  forecasts: CCForecast[]
  positions: CCPosition[]
  ideas: CCIdea[]
  is_authenticated: boolean
  generated_at: string
}

// ─── GET /api/exchange/command-center ────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      summary: null,
      watchlist: [],
      alerts: [],
      forecasts: [],
      positions: [],
      ideas: [],
      is_authenticated: false,
      generated_at: new Date().toISOString(),
    } satisfies Omit<CommandCenterResponse, 'summary'> & { summary: null }, { status: 200 })
  }

  // Fetch all data in parallel
  const [watchlistRes, alertsRes, forecastsRes, votesRes, ideasRes] = await Promise.all([
    supabase
      .from('exchange_watchlist')
      .select(`
        topic_id,
        note,
        added_at,
        topic:topics (
          statement, category, status,
          blue_pct, total_votes
        )
      `)
      .eq('user_id', user.id)
      .order('added_at', { ascending: false })
      .limit(10),

    supabase
      .from('exchange_price_alerts')
      .select(`
        id,
        topic_id,
        threshold,
        direction,
        is_triggered,
        created_at,
        topic:topics (
          statement, category, status, blue_pct
        )
      `)
      .eq('user_id', user.id)
      .eq('is_triggered', false)
      .order('created_at', { ascending: false })
      .limit(15),

    supabase
      .from('exchange_forecasts')
      .select(`
        id,
        topic_id,
        target_price,
        direction,
        horizon,
        confidence,
        created_at,
        updated_at,
        topic:topics!exchange_forecasts_topic_id_fkey (
          statement, category, status, blue_pct
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10),

    supabase
      .from('votes')
      .select(`
        topic_id,
        side,
        created_at,
        topic:topics (
          statement, category, status, blue_pct
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('market_ideas')
      .select(`
        id,
        topic_id,
        title,
        direction,
        upvotes,
        downvotes,
        created_at,
        topic:topics (
          statement, category
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // ── Watchlist ──────────────────────────────────────────────────────────────
  const watchlist: CCWatchItem[] = (watchlistRes.data ?? []).map((w) => {
    const t = w.topic as Record<string, unknown> | null
    const price = Math.round((t?.blue_pct as number) ?? 50)
    return {
      topic_id: w.topic_id,
      statement: (t?.statement as string) ?? '',
      category: (t?.category as string | null) ?? null,
      status: (t?.status as string) ?? 'active',
      price,
      delta_24h: null,
      volume: (t?.total_votes as number) ?? 0,
      added_at: w.added_at,
      note: w.note ?? null,
    }
  })

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: CCAlert[] = (alertsRes.data ?? []).map((a) => {
    const t = a.topic as Record<string, unknown> | null
    const currentPrice = Math.round((t?.blue_pct as number) ?? 50)
    const threshold = a.threshold
    const direction = a.direction as 'above' | 'below'

    // proximity_pct: how close are we? 100 = at threshold, 0 = far away
    const distance = Math.abs(currentPrice - threshold)
    const proximity_pct = Math.max(0, Math.min(100, Math.round(100 - distance * 2)))

    return {
      id: a.id,
      topic_id: a.topic_id,
      statement: (t?.statement as string) ?? '',
      category: (t?.category as string | null) ?? null,
      status: (t?.status as string) ?? 'active',
      current_price: currentPrice,
      threshold,
      direction,
      proximity_pct,
      is_triggered: false,
      created_at: a.created_at,
    }
  }).sort((a, b) => b.proximity_pct - a.proximity_pct)

  // ── Forecasts ─────────────────────────────────────────────────────────────
  const forecasts: CCForecast[] = (forecastsRes.data ?? []).map((f) => {
    const t = f.topic as Record<string, unknown> | null
    const currentPrice = Math.round((t?.blue_pct as number) ?? 50)
    const targetPrice = f.target_price
    const delta = targetPrice - currentPrice
    const accuracy_score = Math.max(0, Math.round(100 - Math.abs(delta) * 2))

    return {
      id: f.id,
      topic_id: f.topic_id,
      statement: (t?.statement as string) ?? '',
      category: (t?.category as string | null) ?? null,
      status: (t?.status as string) ?? 'active',
      current_price: currentPrice,
      target_price: targetPrice,
      direction: f.direction as 'bullish' | 'bearish' | 'neutral',
      horizon: f.horizon,
      confidence: f.confidence,
      delta,
      accuracy_score,
      created_at: f.created_at,
    }
  })

  // ── Positions / Portfolio ─────────────────────────────────────────────────
  const positions: CCPosition[] = (votesRes.data ?? []).map((v) => {
    const t = v.topic as Record<string, unknown> | null
    const currentPrice = Math.round((t?.blue_pct as number) ?? 50)
    const status = (t?.status as string) ?? 'active'
    const side = v.side as 'blue' | 'red'
    const isSettled = status === 'law' || status === 'failed'

    // PnL: if you voted blue (FOR), you win when price goes up
    // Simplified: use current price as proxy for entry (no historical data per-vote)
    const pnl =
      side === 'blue'
        ? currentPrice - 50   // simplified: did you bet right vs neutral?
        : 50 - currentPrice

    let outcome: CCPosition['outcome']
    if (isSettled) {
      outcome = (status === 'law' && side === 'blue') || (status === 'failed' && side === 'red')
        ? 'settled_win'
        : 'settled_loss'
    } else if (Math.abs(pnl) < 2) {
      outcome = 'push'
    } else {
      outcome = pnl > 0 ? 'winning' : 'losing'
    }

    return {
      topic_id: v.topic_id,
      statement: (t?.statement as string) ?? '',
      category: (t?.category as string | null) ?? null,
      side,
      current_price: currentPrice,
      status,
      pnl,
      outcome,
      is_settled: isSettled,
      voted_at: v.created_at,
    }
  })

  // ── Ideas ─────────────────────────────────────────────────────────────────
  const ideas: CCIdea[] = (ideasRes.data ?? []).map((i) => {
    const t = i.topic as Record<string, unknown> | null
    return {
      id: i.id,
      topic_id: i.topic_id,
      statement: (t?.statement as string | null) ?? null,
      category: (t?.category as string | null) ?? null,
      title: i.title,
      direction: i.direction as 'for' | 'against' | 'neutral',
      upvotes: i.upvotes,
      downvotes: i.downvotes,
      score: i.upvotes - i.downvotes,
      created_at: i.created_at,
    }
  })

  // ── Summary Stats ─────────────────────────────────────────────────────────
  const settledPositions = positions.filter((p) => p.is_settled)
  const wins = settledPositions.filter((p) => p.outcome === 'settled_win').length
  const losses = settledPositions.filter((p) => p.outcome === 'settled_loss').length
  const winRate = settledPositions.length > 0 ? wins / settledPositions.length : null
  const netPnl = positions.reduce((sum, p) => sum + p.pnl, 0)

  const avgForecastAccuracy =
    forecasts.length > 0
      ? Math.round(forecasts.reduce((s, f) => s + f.accuracy_score, 0) / forecasts.length)
      : null

  const alertsNear = alerts.filter((a) => a.proximity_pct >= 70).length
  const forecastsOnTarget = forecasts.filter((f) => Math.abs(f.delta) <= 5).length
  const ideasScore = ideas.reduce((s, i) => s + i.score, 0)

  const summary: CommandCenterSummary = {
    total_watched: watchlist.length,
    active_alerts: alerts.length,
    total_forecasts: forecasts.length,
    open_positions: positions.filter((p) => !p.is_settled).length,
    settled_wins: wins,
    settled_losses: losses,
    win_rate: winRate !== null ? Math.round(winRate * 100) : null,
    avg_forecast_accuracy: avgForecastAccuracy,
    net_pnl: Math.round(netPnl),
    alerts_near_threshold: alertsNear,
    forecasts_on_target: forecastsOnTarget,
    ideas_score: ideasScore,
  }

  return NextResponse.json({
    summary,
    watchlist,
    alerts,
    forecasts,
    positions: positions.slice(0, 10),
    ideas,
    is_authenticated: true,
    generated_at: new Date().toISOString(),
  } satisfies CommandCenterResponse)
}
