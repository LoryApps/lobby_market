import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ChartSnapshot {
  price: number
  volume: number
  recorded_at: string
}

export interface ChartStats {
  open: number
  high: number
  low: number
  close: number
  change: number
  change_pct: number
  volume_total: number
  snapshots: number
}

export interface ChartResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    scope: string
  }
  history: ChartSnapshot[]
  stats: ChartStats
  resolution_at: string | null
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const { searchParams } = new URL(req.url)
  const window = searchParams.get('window') ?? 'all'

  const supabase = await createClient()

  // ── Topic ───────────────────────────────────────────────────────────────────

  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, voting_ends_at, blue_pct, total_votes')
    .eq('id', id)
    .single()

  if (error || !topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── Time window ─────────────────────────────────────────────────────────────

  let since: string | null = null
  const now = Date.now()
  if (window === '7d')  since = new Date(now - 7  * 86_400_000).toISOString()
  if (window === '30d') since = new Date(now - 30 * 86_400_000).toISOString()
  if (window === '90d') since = new Date(now - 90 * 86_400_000).toISOString()

  // ── Price history ────────────────────────────────────────────────────────────

  let query = supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: true })
    .limit(1000)

  if (since) {
    query = query.gte('recorded_at', since)
  }

  const { data: rawHistory } = await query

  const history: ChartSnapshot[] = rawHistory ?? []

  // Inject a synthetic "current" snapshot so charts always end at the live price
  const livePrice = topic.blue_pct ?? 50
  const liveVol = topic.total_votes ?? 0
  if (history.length === 0 || history[history.length - 1].price !== livePrice) {
    history.push({ price: livePrice, volume: liveVol, recorded_at: new Date().toISOString() })
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const prices = history.map((h) => h.price)
  const open = prices[0] ?? 50
  const close = prices[prices.length - 1] ?? 50
  const high = Math.max(...prices)
  const low = Math.min(...prices)
  const change = close - open
  const change_pct = open !== 0 ? (change / open) * 100 : 0
  const volume_total = history.length > 0 ? history[history.length - 1].volume : liveVol

  const stats: ChartStats = {
    open: Math.round(open * 10) / 10,
    high: Math.round(high * 10) / 10,
    low: Math.round(low * 10) / 10,
    close: Math.round(close * 10) / 10,
    change: Math.round(change * 10) / 10,
    change_pct: Math.round(change_pct * 10) / 10,
    volume_total,
    snapshots: history.length,
  }

  const response: ChartResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      scope: topic.scope,
    },
    history,
    stats,
    resolution_at: topic.voting_ends_at ?? null,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
