import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PriceTick {
  recorded_at: string
  price: number
}

export interface MarketHistory {
  topic_id: string
  ticks: PriceTick[]
  /** Latest price (blue_pct now) */
  current_price: number
  /** First tick in range — for delta calculation */
  open_price: number
  /** Price delta over the period */
  delta: number
}

export interface GroupHistoryResponse {
  markets: MarketHistory[]
  /** Weighted aggregate "index" series — one tick per shared timestamp bucket */
  index: PriceTick[]
  /** Overall index delta over the period */
  index_delta: number
}

// Returns up to 30 days of price history for every market in the group
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Load group to check access
  const { data: group, error: gErr } = await supabase
    .from('exchange_groups')
    .select('id, user_id, is_public')
    .eq('id', params.id)
    .single()

  if (gErr || !group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = user?.id === (group.user_id as string)
  if (!isOwner && !(group.is_public as boolean)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get the topic IDs in this group
  const { data: items } = await supabase
    .from('exchange_group_items')
    .select('topic_id')
    .eq('group_id', params.id)
    .limit(50)

  const topicIds = (items ?? []).map((r) => (r as Record<string, unknown>).topic_id as string)
  if (topicIds.length === 0) {
    return NextResponse.json({ markets: [], index: [], index_delta: 0 })
  }

  // Get current prices
  const { data: currentPrices } = await supabase
    .from('topics')
    .select('id, blue_pct')
    .in('id', topicIds)

  const priceMap: Record<string, number> = {}
  for (const row of currentPrices ?? []) {
    priceMap[(row as Record<string, unknown>).id as string] = Math.round(
      ((row as Record<string, unknown>).blue_pct as number) ?? 50
    )
  }

  // Fetch price history for all group markets in the past 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: histRows } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, recorded_at')
    .in('topic_id', topicIds)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })
    .limit(2000)

  // Group rows by topic
  const byTopic: Record<string, PriceTick[]> = {}
  for (const row of histRows ?? []) {
    const r = row as Record<string, unknown>
    const tid = r.topic_id as string
    if (!byTopic[tid]) byTopic[tid] = []
    byTopic[tid].push({ recorded_at: r.recorded_at as string, price: Math.round(r.price as number) })
  }

  const markets: MarketHistory[] = topicIds.map((tid) => {
    const ticks = byTopic[tid] ?? []
    const current = priceMap[tid] ?? 50
    const open = ticks.length > 0 ? ticks[0].price : current
    // Ensure at least a start + current point for sparklines
    const fullTicks: PriceTick[] = ticks.length > 0
      ? [...ticks, { recorded_at: new Date().toISOString(), price: current }]
      : [{ recorded_at: since, price: current }, { recorded_at: new Date().toISOString(), price: current }]
    return { topic_id: tid, ticks: fullTicks, current_price: current, open_price: open, delta: current - open }
  })

  // Build aggregate index: average price at each 6-hour bucket
  // We use a simple approach: sample at each unique timestamp across all markets,
  // average the "interpolated" price at that time.
  const allTimestamps = Array.from(
    new Set((histRows ?? []).map((r) => (r as Record<string, unknown>).recorded_at as string))
  ).sort()

  // Downsample to at most 60 points for a clean sparkline
  const maxPoints = 60
  const step = Math.max(1, Math.floor(allTimestamps.length / maxPoints))
  const sampledTs = allTimestamps.filter((_, i) => i % step === 0)
  // Always include the last point
  if (allTimestamps.length > 0 && sampledTs[sampledTs.length - 1] !== allTimestamps[allTimestamps.length - 1]) {
    sampledTs.push(allTimestamps[allTimestamps.length - 1])
  }

  // For each sampled timestamp, compute average price across markets that have data
  const indexTicks: PriceTick[] = sampledTs.map((ts) => {
    let sum = 0
    let count = 0
    for (const market of markets) {
      // Find the last known price at or before this timestamp
      const relevantTicks = market.ticks.filter((t) => t.recorded_at <= ts)
      if (relevantTicks.length > 0) {
        sum += relevantTicks[relevantTicks.length - 1].price
        count++
      }
    }
    return { recorded_at: ts, price: count > 0 ? Math.round(sum / count) : 50 }
  })

  // Add current prices as final index point
  const currentAvg = markets.length > 0
    ? Math.round(markets.reduce((a, m) => a + m.current_price, 0) / markets.length)
    : 50
  indexTicks.push({ recorded_at: new Date().toISOString(), price: currentAvg })

  const indexOpen = indexTicks.length > 1 ? indexTicks[0].price : currentAvg
  const indexDelta = currentAvg - indexOpen

  return NextResponse.json({
    markets,
    index: indexTicks,
    index_delta: indexDelta,
  } satisfies GroupHistoryResponse)
}
