import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StrategyDirection = 'for' | 'against' | 'momentum' | 'contrarian'

export interface BacktestTrade {
  topic_id: string
  statement: string
  category: string | null
  entry_price: number      // consensus % at simulated entry (0–100)
  outcome_score: number    // 100 if law, 0 if failed
  outcome: 'law' | 'failed'
  direction: 'for' | 'against'
  pnl: number              // points gained/lost (-100 to +100)
  cumulative_pnl: number   // running total after this trade
  resolved_at: string
  total_votes: number
}

export interface BacktestStats {
  total_trades: number
  wins: number
  losses: number
  win_rate: number
  total_pnl: number
  avg_pnl: number
  best_trade: BacktestTrade | null
  worst_trade: BacktestTrade | null
  max_drawdown: number
  by_category: Array<{
    category: string
    trades: number
    wins: number
    pnl: number
  }>
}

export interface BacktestResponse {
  trades: BacktestTrade[]
  stats: BacktestStats
  strategy: {
    direction: StrategyDirection
    min_price: number
    max_price: number
    category: string | null
    min_volume: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const direction = (searchParams.get('direction') || 'momentum') as StrategyDirection
  const minPrice  = Math.max(0,   parseInt(searchParams.get('min_price')  || '0',   10))
  const maxPrice  = Math.min(100, parseInt(searchParams.get('max_price')  || '100', 10))
  const category  = searchParams.get('category') || null
  const minVolume = Math.max(0,   parseInt(searchParams.get('min_volume') || '0',   10))

  // ── Fetch resolved topics ─────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, updated_at')
    .in('status', ['law', 'failed'])
    .order('updated_at', { ascending: true })
    .limit(500)

  if (category) query = query.eq('category', category)

  const { data: resolvedTopics, error } = await query

  if (error || !resolvedTopics) {
    return NextResponse.json({ error: 'Failed to load resolved markets' }, { status: 500 })
  }

  if (resolvedTopics.length === 0) {
    return NextResponse.json<BacktestResponse>({
      trades: [],
      stats: {
        total_trades: 0,
        wins: 0,
        losses: 0,
        win_rate: 0,
        total_pnl: 0,
        avg_pnl: 0,
        best_trade: null,
        worst_trade: null,
        max_drawdown: 0,
        by_category: [],
      },
      strategy: { direction, min_price: minPrice, max_price: maxPrice, category, min_volume: minVolume },
    })
  }

  // ── Fetch earliest price snapshots for each topic ─────────────────────────
  const topicIds = resolvedTopics.map((t) => t.id)

  // Get the earliest snapshot per topic (simulated entry price)
  const { data: snapshots } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, volume, recorded_at')
    .in('topic_id', topicIds)
    .order('recorded_at', { ascending: true })

  // Build a map of topic_id → earliest snapshot
  const snapshotMap = new Map<string, { price: number; volume: number }>()
  if (snapshots) {
    for (const snap of snapshots) {
      if (!snapshotMap.has(snap.topic_id)) {
        snapshotMap.set(snap.topic_id, { price: snap.price, volume: snap.volume })
      }
    }
  }

  // ── Simulate trades ───────────────────────────────────────────────────────
  const trades: Omit<BacktestTrade, 'cumulative_pnl'>[] = []

  for (const topic of resolvedTopics) {
    const snap = snapshotMap.get(topic.id)
    // Use snapshot entry price if available, fall back to final blue_pct
    const entryPrice = snap?.price ?? topic.blue_pct ?? 50
    const entryVolume = snap?.volume ?? topic.total_votes ?? 0

    // Volume filter
    if (entryVolume < minVolume) continue

    // Price range filter (applied before direction resolution)
    if (entryPrice < minPrice || entryPrice > maxPrice) continue

    // Determine side based on strategy
    let side: 'for' | 'against'
    if (direction === 'for') {
      side = 'for'
    } else if (direction === 'against') {
      side = 'against'
    } else if (direction === 'momentum') {
      // Follow the crowd: bet FOR if majority says so
      side = entryPrice >= 50 ? 'for' : 'against'
    } else {
      // Contrarian: bet against the crowd
      side = entryPrice >= 50 ? 'against' : 'for'
    }

    const outcome = topic.status as 'law' | 'failed'
    const outcomeScore = outcome === 'law' ? 100 : 0
    const pnl = side === 'for'
      ? outcomeScore - entryPrice
      : entryPrice - outcomeScore

    trades.push({
      topic_id: topic.id,
      statement: topic.statement,
      category: topic.category,
      entry_price: Math.round(entryPrice),
      outcome_score: outcomeScore,
      outcome,
      direction: side,
      pnl: Math.round(pnl * 10) / 10,
      resolved_at: topic.updated_at,
      total_votes: topic.total_votes ?? 0,
    })
  }

  // ── Add cumulative P&L ────────────────────────────────────────────────────
  let cumPnl = 0
  const fullTrades: BacktestTrade[] = trades.map((t) => {
    cumPnl += t.pnl
    return { ...t, cumulative_pnl: Math.round(cumPnl * 10) / 10 }
  })

  // ── Stats ─────────────────────────────────────────────────────────────────
  const wins   = fullTrades.filter((t) => t.pnl > 0).length
  const losses = fullTrades.filter((t) => t.pnl < 0).length
  const totalPnl = fullTrades.reduce((s, t) => s + t.pnl, 0)

  // Max drawdown: biggest drop from a running peak
  let peak = 0
  let maxDrawdown = 0
  let running = 0
  for (const t of fullTrades) {
    running += t.pnl
    if (running > peak) peak = running
    const dd = peak - running
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const byCategory = new Map<string, { trades: number; wins: number; pnl: number }>()
  for (const t of fullTrades) {
    const key = t.category || 'Uncategorised'
    const cur = byCategory.get(key) || { trades: 0, wins: 0, pnl: 0 }
    cur.trades += 1
    if (t.pnl > 0) cur.wins += 1
    cur.pnl += t.pnl
    byCategory.set(key, cur)
  }

  const sortedTrades = [...fullTrades].sort((a, b) => b.pnl - a.pnl)
  const bestTrade  = sortedTrades[0]  ?? null
  const worstTrade = sortedTrades[sortedTrades.length - 1] ?? null

  const stats: BacktestStats = {
    total_trades: fullTrades.length,
    wins,
    losses,
    win_rate: fullTrades.length > 0 ? Math.round((wins / fullTrades.length) * 1000) / 10 : 0,
    total_pnl: Math.round(totalPnl * 10) / 10,
    avg_pnl: fullTrades.length > 0 ? Math.round((totalPnl / fullTrades.length) * 10) / 10 : 0,
    best_trade: bestTrade,
    worst_trade: worstTrade,
    max_drawdown: Math.round(maxDrawdown * 10) / 10,
    by_category: Array.from(byCategory.entries())
      .map(([category, data]) => ({ category, ...data, pnl: Math.round(data.pnl * 10) / 10 }))
      .sort((a, b) => b.pnl - a.pnl),
  }

  return NextResponse.json<BacktestResponse>({
    trades: fullTrades,
    stats,
    strategy: { direction, min_price: minPrice, max_price: maxPrice, category, min_volume: minVolume },
  })
}
