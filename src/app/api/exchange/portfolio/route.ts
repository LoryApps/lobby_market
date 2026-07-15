import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortfolioPosition {
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  voted_at: string
  entry_price: number      // consensus % at time of vote (0-100)
  current_price: number    // current blue_pct
  status: string
  total_votes: number
  // Computed
  pnl: number              // current_price - entry_price (if blue) or entry_price - current_price (if red)
  pnl_pct: number          // pnl as % of entry
  outcome: 'winning' | 'losing' | 'settled_win' | 'settled_loss' | 'push'
  is_settled: boolean
}

export interface PortfolioStats {
  total_positions: number
  open_positions: number
  settled_positions: number
  wins: number
  losses: number
  pushes: number
  win_rate: number | null
  total_return: number     // sum of pnl across all positions
  avg_entry_price: number
  best_position: PortfolioPosition | null
  worst_position: PortfolioPosition | null
  by_category: Array<{ category: string; count: number; net_pnl: number }>
  by_side: { blue: number; red: number }
}

export interface PortfolioResponse {
  positions: PortfolioPosition[]
  stats: PortfolioStats
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all the user's votes joined with topic data
  const { data: votes, error } = await supabase
    .from('votes')
    .select(`
      topic_id,
      side,
      created_at,
      topics!inner (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !votes) {
    return NextResponse.json({ error: 'Failed to load votes' }, { status: 500 })
  }

  // For each voted topic, find the price at vote time from price_history
  const topicIds = [...new Set(votes.map((v) => v.topic_id))]

  // Fetch price history for all relevant topics in one query
  const { data: priceHistory } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .in('topic_id', topicIds)
    .order('recorded_at', { ascending: true })

  // Group price history by topic
  const historyByTopic = new Map<string, Array<{ price: number; recorded_at: string }>>()
  for (const row of priceHistory ?? []) {
    const key = row.topic_id as string
    if (!historyByTopic.has(key)) historyByTopic.set(key, [])
    historyByTopic.get(key)!.push({ price: row.price as number, recorded_at: row.recorded_at as string })
  }

  // Build positions
  const positions: PortfolioPosition[] = []

  for (const vote of votes) {
    const topic = Array.isArray(vote.topics) ? vote.topics[0] : vote.topics
    if (!topic) continue

    const votedAt = new Date(vote.created_at).getTime()
    const history = historyByTopic.get(vote.topic_id) ?? []

    // Find closest price snapshot at or before the vote
    let entryPrice = 50 // default
    if (history.length > 0) {
      const before = [...history]
        .filter((h) => new Date(h.recorded_at).getTime() <= votedAt)
        .pop()
      const after = history.find((h) => new Date(h.recorded_at).getTime() > votedAt)

      if (before) entryPrice = before.price
      else if (after) entryPrice = after.price
      else entryPrice = history[0].price
    }

    const currentPrice = (topic as { blue_pct: number | null }).blue_pct ?? 50
    const side = vote.side as 'blue' | 'red'
    const status = (topic as { status: string }).status

    // PnL: if voted blue, win when price goes up; if voted red, win when price goes down
    const pnl = side === 'blue'
      ? currentPrice - entryPrice
      : entryPrice - currentPrice

    const pnlPct = entryPrice > 0 ? (pnl / entryPrice) * 100 : 0

    const isSettled = status === 'law' || status === 'failed'

    let outcome: PortfolioPosition['outcome']
    if (isSettled) {
      if (status === 'law' && side === 'blue') outcome = 'settled_win'
      else if (status === 'failed' && side === 'red') outcome = 'settled_win'
      else if (status === 'law' && side === 'red') outcome = 'settled_loss'
      else if (status === 'failed' && side === 'blue') outcome = 'settled_loss'
      else outcome = 'push'
    } else {
      if (pnl > 2) outcome = 'winning'
      else if (pnl < -2) outcome = 'losing'
      else outcome = 'push'
    }

    positions.push({
      topic_id: vote.topic_id,
      statement: (topic as { statement: string }).statement,
      category: (topic as { category: string | null }).category,
      side,
      voted_at: vote.created_at,
      entry_price: Math.round(entryPrice * 10) / 10,
      current_price: Math.round(currentPrice * 10) / 10,
      status,
      total_votes: (topic as { total_votes: number | null }).total_votes ?? 0,
      pnl: Math.round(pnl * 10) / 10,
      pnl_pct: Math.round(pnlPct * 10) / 10,
      outcome,
      is_settled: isSettled,
    })
  }

  // Compute stats
  const settled = positions.filter((p) => p.is_settled)
  const open = positions.filter((p) => !p.is_settled)
  const wins = settled.filter((p) => p.outcome === 'settled_win').length
  const losses = settled.filter((p) => p.outcome === 'settled_loss').length
  const pushes = settled.filter((p) => p.outcome === 'push').length
  const winRate = settled.length > 0 ? Math.round((wins / settled.length) * 100) : null

  const totalReturn = positions.reduce((sum, p) => sum + p.pnl, 0)
  const avgEntry =
    positions.length > 0
      ? positions.reduce((sum, p) => sum + p.entry_price, 0) / positions.length
      : 50

  const sorted = [...positions].sort((a, b) => b.pnl - a.pnl)
  const bestPosition = sorted[0] ?? null
  const worstPosition = sorted[sorted.length - 1] ?? null

  // By category
  const catMap = new Map<string, { count: number; net_pnl: number }>()
  for (const p of positions) {
    const cat = p.category ?? 'Other'
    const prev = catMap.get(cat) ?? { count: 0, net_pnl: 0 }
    catMap.set(cat, { count: prev.count + 1, net_pnl: prev.net_pnl + p.pnl })
  }
  const byCategory = [...catMap.entries()]
    .map(([category, { count, net_pnl }]) => ({ category, count, net_pnl: Math.round(net_pnl * 10) / 10 }))
    .sort((a, b) => b.count - a.count)

  const byBlue = positions.filter((p) => p.side === 'blue').length
  const byRed = positions.filter((p) => p.side === 'red').length

  const stats: PortfolioStats = {
    total_positions: positions.length,
    open_positions: open.length,
    settled_positions: settled.length,
    wins,
    losses,
    pushes,
    win_rate: winRate,
    total_return: Math.round(totalReturn * 10) / 10,
    avg_entry_price: Math.round(avgEntry * 10) / 10,
    best_position: bestPosition,
    worst_position: worstPosition,
    by_category: byCategory,
    by_side: { blue: byBlue, red: byRed },
  }

  return NextResponse.json({ positions, stats } satisfies PortfolioResponse)
}
