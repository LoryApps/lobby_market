import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StrategyDirection = 'for' | 'against' | 'momentum' | 'contrarian'

export interface LiveSignal {
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number   // current blue_pct (0–100)
  entry_price: number     // earliest snapshot price — simulated entry
  entry_volume: number
  current_volume: number
  direction: 'for' | 'against'
  unrealized_pnl: number  // current_price delta from entry in chosen direction
  total_votes: number
  view_count: number
  created_at: string
  signal_strength: 'strong' | 'moderate' | 'weak'
}

export interface StrategyStats {
  total_signals: number
  avg_unrealized_pnl: number
  best_signal: LiveSignal | null
  worst_signal: LiveSignal | null
  by_category: Array<{
    category: string
    count: number
    avg_pnl: number
  }>
  // From backtesting resolved markets with same params
  historical_win_rate: number | null
  historical_trades: number
}

export interface StrategyResponse {
  signals: LiveSignal[]
  stats: StrategyStats
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

  // ── 1. Fetch active / proposed topics ────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
    .in('status', ['active', 'proposed', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(200)

  if (category) query = query.eq('category', category)

  const { data: activeTopics, error } = await query

  if (error || !activeTopics) {
    return NextResponse.json({ error: 'Failed to load active markets' }, { status: 500 })
  }

  // ── 2. Fetch earliest price snapshots (simulated entry) ───────────────────
  const topicIds = activeTopics.map((t) => t.id)

  const { data: snapshots } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, volume, recorded_at')
    .in('topic_id', topicIds)
    .order('recorded_at', { ascending: true })

  // Map topic_id → earliest snapshot
  const snapshotMap = new Map<string, { price: number; volume: number }>()
  if (snapshots) {
    for (const snap of snapshots) {
      if (!snapshotMap.has(snap.topic_id)) {
        snapshotMap.set(snap.topic_id, { price: snap.price, volume: snap.volume })
      }
    }
  }

  // ── 3. Build live signals ─────────────────────────────────────────────────
  const signals: LiveSignal[] = []

  for (const topic of activeTopics) {
    const currentPrice = topic.blue_pct ?? 50
    const snap = snapshotMap.get(topic.id)
    const entryPrice  = snap?.price  ?? currentPrice
    const entryVolume = snap?.volume ?? 0

    // Volume filter (use current volume)
    if ((topic.total_votes ?? 0) < minVolume) continue

    // Price range filter (applied at entry price)
    if (entryPrice < minPrice || entryPrice > maxPrice) continue

    // Determine direction
    let side: 'for' | 'against'
    if (direction === 'for') {
      side = 'for'
    } else if (direction === 'against') {
      side = 'against'
    } else if (direction === 'momentum') {
      side = entryPrice >= 50 ? 'for' : 'against'
    } else {
      // contrarian
      side = entryPrice >= 50 ? 'against' : 'for'
    }

    // Unrealized PnL: how much has the price moved in our favour?
    const unrealized = side === 'for'
      ? currentPrice - entryPrice
      : entryPrice - currentPrice

    // Signal strength based on PnL magnitude
    const absUnrealized = Math.abs(unrealized)
    const strength: LiveSignal['signal_strength'] =
      absUnrealized >= 10 ? 'strong' :
      absUnrealized >= 4  ? 'moderate' :
                            'weak'

    signals.push({
      topic_id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      current_price: Math.round(currentPrice),
      entry_price: Math.round(entryPrice),
      entry_volume: entryVolume,
      current_volume: topic.total_votes ?? 0,
      direction: side,
      unrealized_pnl: Math.round(unrealized * 10) / 10,
      total_votes: topic.total_votes ?? 0,
      view_count: topic.view_count ?? 0,
      created_at: topic.created_at,
      signal_strength: strength,
    })
  }

  // Sort by unrealized PnL descending (winners first)
  signals.sort((a, b) => b.unrealized_pnl - a.unrealized_pnl)

  // ── 4. Compute stats ──────────────────────────────────────────────────────
  const avgPnl = signals.length > 0
    ? signals.reduce((s, t) => s + t.unrealized_pnl, 0) / signals.length
    : 0

  const byCategory = new Map<string, { count: number; total_pnl: number }>()
  for (const sig of signals) {
    const key = sig.category || 'Uncategorised'
    const cur = byCategory.get(key) || { count: 0, total_pnl: 0 }
    cur.count += 1
    cur.total_pnl += sig.unrealized_pnl
    byCategory.set(key, cur)
  }

  // ── 5. Historical win rate from resolved topics ───────────────────────────
  let historicalWinRate: number | null = null
  let historicalTrades = 0

  try {
    let resolvedQuery = supabase
      .from('topics')
      .select('id, status, blue_pct, total_votes')
      .in('status', ['law', 'failed'])
      .limit(500)

    if (category) resolvedQuery = resolvedQuery.eq('category', category)

    const { data: resolvedTopics } = await resolvedQuery

    if (resolvedTopics && resolvedTopics.length > 0) {
      const resolvedIds = resolvedTopics.map((t) => t.id)

      const { data: resolvedSnaps } = await supabase
        .from('topic_price_history')
        .select('topic_id, price, volume')
        .in('topic_id', resolvedIds)
        .order('recorded_at', { ascending: true })

      const resolvedSnapMap = new Map<string, { price: number; volume: number }>()
      if (resolvedSnaps) {
        for (const snap of resolvedSnaps) {
          if (!resolvedSnapMap.has(snap.topic_id)) {
            resolvedSnapMap.set(snap.topic_id, { price: snap.price, volume: snap.volume })
          }
        }
      }

      let wins = 0
      let trades = 0

      for (const topic of resolvedTopics) {
        const snap = resolvedSnapMap.get(topic.id)
        const ep = snap?.price ?? topic.blue_pct ?? 50
        const ev = snap?.volume ?? topic.total_votes ?? 0

        if (ev < minVolume) continue
        if (ep < minPrice || ep > maxPrice) continue

        let side: 'for' | 'against'
        if (direction === 'for') side = 'for'
        else if (direction === 'against') side = 'against'
        else if (direction === 'momentum') side = ep >= 50 ? 'for' : 'against'
        else side = ep >= 50 ? 'against' : 'for'

        const outcome = topic.status as 'law' | 'failed'
        const pnl = side === 'for'
          ? (outcome === 'law' ? 100 : 0) - ep
          : ep - (outcome === 'law' ? 100 : 0)

        trades += 1
        if (pnl > 0) wins += 1
      }

      if (trades > 0) {
        historicalWinRate = Math.round((wins / trades) * 1000) / 10
        historicalTrades = trades
      }
    }
  } catch {
    // Non-fatal — win rate stays null
  }

  const stats: StrategyStats = {
    total_signals: signals.length,
    avg_unrealized_pnl: Math.round(avgPnl * 10) / 10,
    best_signal:  signals[0]  ?? null,
    worst_signal: signals[signals.length - 1] ?? null,
    by_category: Array.from(byCategory.entries())
      .map(([cat, d]) => ({
        category: cat,
        count: d.count,
        avg_pnl: Math.round((d.total_pnl / d.count) * 10) / 10,
      }))
      .sort((a, b) => b.avg_pnl - a.avg_pnl),
    historical_win_rate: historicalWinRate,
    historical_trades: historicalTrades,
  }

  return NextResponse.json<StrategyResponse>({
    signals,
    stats,
    strategy: { direction, min_price: minPrice, max_price: maxPrice, category, min_volume: minVolume },
  })
}
