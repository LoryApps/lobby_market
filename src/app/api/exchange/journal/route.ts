import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JournalEntry {
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  voted_at: string
  entry_price: number
  current_price: number
  status: string
  total_votes: number
  pnl: number
  outcome: 'winning' | 'losing' | 'settled_win' | 'settled_loss' | 'push' | 'open'
  is_settled: boolean
  // Debate-side data for context
  top_for_arg: string | null
  top_against_arg: string | null
}

export interface JournalResponse {
  entries: JournalEntry[]
  summary: {
    total: number
    open: number
    settled: number
    wins: number
    losses: number
    win_rate: number | null
    net_pnl: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Votes with topic data
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
    .limit(300)

  if (error || !votes) {
    return NextResponse.json({ error: 'Failed to load votes' }, { status: 500 })
  }

  const topicIds = [...new Set(votes.map((v) => v.topic_id))]

  // Price history for entry prices
  const { data: priceHistory } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .in('topic_id', topicIds)
    .order('recorded_at', { ascending: true })

  const historyByTopic = new Map<string, Array<{ price: number; recorded_at: string }>>()
  for (const row of priceHistory ?? []) {
    const key = row.topic_id as string
    if (!historyByTopic.has(key)) historyByTopic.set(key, [])
    historyByTopic.get(key)!.push({
      price: row.price as number,
      recorded_at: row.recorded_at as string,
    })
  }

  // Top arguments per topic (for context)
  const { data: argRows } = await supabase
    .from('arguments')
    .select('topic_id, body, side, upvotes')
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })
    .limit(topicIds.length * 4)

  const topArgByTopic = new Map<string, { for: string | null; against: string | null }>()
  for (const arg of argRows ?? []) {
    const tid = arg.topic_id as string
    const current = topArgByTopic.get(tid) ?? { for: null, against: null }
    if (arg.side === 'blue' && !current.for)
      current.for = (arg.body as string)?.slice(0, 160) ?? null
    if (arg.side === 'red' && !current.against)
      current.against = (arg.body as string)?.slice(0, 160) ?? null
    topArgByTopic.set(tid, current)
  }

  const entries: JournalEntry[] = []

  for (const vote of votes) {
    const topic = vote.topics as {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number | null
      total_votes: number | null
    }

    const side = vote.side as 'blue' | 'red'
    const currentPrice = topic.blue_pct ?? 50
    const status = topic.status as string

    // Find entry price from price history closest to vote time
    const history = historyByTopic.get(vote.topic_id) ?? []
    const voteTime = new Date(vote.created_at).getTime()
    let entryPrice = currentPrice

    if (history.length > 0) {
      const closestBefore = history
        .filter((h) => new Date(h.recorded_at).getTime() <= voteTime)
        .at(-1)
      if (closestBefore) {
        entryPrice = closestBefore.price
      } else {
        entryPrice = history[0]?.price ?? currentPrice
      }
    }

    const isSettled = status === 'law' || status === 'failed'

    let pnl = 0
    if (side === 'blue') {
      pnl = currentPrice - entryPrice
    } else {
      pnl = entryPrice - currentPrice
    }

    let outcome: JournalEntry['outcome']
    if (isSettled) {
      if (status === 'law' && side === 'blue') outcome = 'settled_win'
      else if (status === 'failed' && side === 'red') outcome = 'settled_win'
      else if (status === 'law' && side === 'red') outcome = 'settled_loss'
      else if (status === 'failed' && side === 'blue') outcome = 'settled_loss'
      else outcome = 'push'
    } else if (pnl > 2) {
      outcome = 'winning'
    } else if (pnl < -2) {
      outcome = 'losing'
    } else {
      outcome = 'open'
    }

    const args = topArgByTopic.get(vote.topic_id)

    entries.push({
      topic_id: vote.topic_id,
      statement: topic.statement,
      category: topic.category,
      side,
      voted_at: vote.created_at,
      entry_price: Math.round(entryPrice * 10) / 10,
      current_price: Math.round(currentPrice * 10) / 10,
      status,
      total_votes: topic.total_votes ?? 0,
      pnl: Math.round(pnl * 10) / 10,
      outcome,
      is_settled: isSettled,
      top_for_arg: args?.for ?? null,
      top_against_arg: args?.against ?? null,
    })
  }

  const settled = entries.filter((e) => e.is_settled)
  const open = entries.filter((e) => !e.is_settled)
  const wins = settled.filter((e) => e.outcome === 'settled_win').length
  const losses = settled.filter((e) => e.outcome === 'settled_loss').length
  const winRate =
    settled.length > 0 ? Math.round((wins / settled.length) * 100) : null
  const netPnl = entries.reduce((s, e) => s + e.pnl, 0)

  return NextResponse.json({
    entries,
    summary: {
      total: entries.length,
      open: open.length,
      settled: settled.length,
      wins,
      losses,
      win_rate: winRate,
      net_pnl: Math.round(netPnl * 10) / 10,
    },
  } satisfies JournalResponse)
}
