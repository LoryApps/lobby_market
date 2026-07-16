import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalType =
  | 'near_law'
  | 'strong_for'
  | 'contested'
  | 'near_failure'
  | 'high_volume'
  | 'momentum_up'
  | 'momentum_down'

export interface SignalMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number          // blue_pct (0–100)
  volume: number         // total_votes
  feed_score: number
  delta_24h: number | null   // price change over 24h (null = no history)
  signal: SignalType
}

export interface SignalGroup {
  type: SignalType
  label: string
  description: string
  markets: SignalMarket[]
}

export interface SignalsResponse {
  groups: SignalGroup[]
  as_of: string
}

// ─── Signal metadata ──────────────────────────────────────────────────────────

const SIGNAL_META: Record<SignalType, { label: string; description: string }> = {
  near_law: {
    label: 'Near Consensus',
    description: 'Markets approaching the 66% law threshold — one push could settle them.',
  },
  strong_for: {
    label: 'Strong FOR',
    description: 'Overwhelming FOR consensus but not yet settled — high-confidence markets.',
  },
  contested: {
    label: 'Contested',
    description: 'Markets locked near 50/50 with significant volume — genuine uncertainty.',
  },
  near_failure: {
    label: 'Strong AGAINST',
    description: 'Markets with strong AGAINST consensus trending toward rejection.',
  },
  high_volume: {
    label: 'High Volume',
    description: 'The most actively traded live markets by total vote count.',
  },
  momentum_up: {
    label: 'Momentum Rising',
    description: 'Markets that gained the most ground in the last 24 hours.',
  },
  momentum_down: {
    label: 'Momentum Falling',
    description: 'Markets that saw the sharpest drops in the last 24 hours.',
  },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all non-proposed, non-settled topics
    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .not('status', 'in', '("proposed","law","failed")')
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(500)

    if (error || !topics) {
      return NextResponse.json(
        { groups: [], as_of: new Date().toISOString() } satisfies SignalsResponse,
        { status: 200 },
      )
    }

    // Fetch 24h price history to compute deltas
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const topicIds = topics.map((t) => t.id as string)

    const { data: history } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, recorded_at')
      .in('topic_id', topicIds)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })

    // Build open-price map (first snapshot in 24h window per topic)
    const openPriceMap = new Map<string, number>()
    for (const row of history ?? []) {
      const id = row.topic_id as string
      if (!openPriceMap.has(id)) {
        openPriceMap.set(id, row.price as number)
      }
    }

    // Helper to compute delta
    function delta24h(id: string, currentPrice: number): number | null {
      const open = openPriceMap.get(id)
      if (open === undefined) return null
      return Math.round((currentPrice - open) * 10) / 10
    }

    function toMarket(t: typeof topics[0], signal: SignalType): SignalMarket {
      const price = Math.round(t.blue_pct ?? 50)
      return {
        id: t.id as string,
        statement: t.statement as string,
        category: t.category as string | null,
        status: t.status as string,
        price,
        volume: t.total_votes as number ?? 0,
        feed_score: t.feed_score as number ?? 0,
        delta_24h: delta24h(t.id as string, price),
        signal,
      }
    }

    // ── Signal 1: Near Consensus (62–66%) ─────────────────────────────────────
    const nearLaw = topics
      .filter((t) => {
        const p = t.blue_pct ?? 50
        return p >= 62 && p < 67
      })
      .slice(0, 6)
      .map((t) => toMarket(t, 'near_law'))

    // ── Signal 2: Strong FOR (≥67%, not yet settled) ──────────────────────────
    const strongFor = topics
      .filter((t) => {
        const p = t.blue_pct ?? 50
        return p >= 67
      })
      .slice(0, 6)
      .map((t) => toMarket(t, 'strong_for'))

    // ── Signal 3: Contested (45–55%, volume ≥30) ──────────────────────────────
    const contested = topics
      .filter((t) => {
        const p = t.blue_pct ?? 50
        const v = t.total_votes ?? 0
        return p >= 45 && p <= 55 && v >= 30
      })
      .sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
      .slice(0, 6)
      .map((t) => toMarket(t, 'contested'))

    // ── Signal 4: Near Failure (≤35%) ─────────────────────────────────────────
    const nearFailure = topics
      .filter((t) => {
        const p = t.blue_pct ?? 50
        return p <= 35
      })
      .sort((a, b) => (a.blue_pct ?? 50) - (b.blue_pct ?? 50))
      .slice(0, 6)
      .map((t) => toMarket(t, 'near_failure'))

    // ── Signal 5: High Volume ──────────────────────────────────────────────────
    const highVolume = topics
      .slice(0, 6)
      .map((t) => toMarket(t, 'high_volume'))

    // ── Signals 6 & 7: Momentum up/down (requires price history) ─────────────
    type DeltaRow = { id: string; open: number; current: number; delta: number }
    const deltaRows: DeltaRow[] = []

    for (const t of topics) {
      const open = openPriceMap.get(t.id as string)
      if (open === undefined) continue
      const current = Math.round(t.blue_pct ?? 50)
      const d = Math.round((current - open) * 10) / 10
      if (Math.abs(d) >= 1) {
        deltaRows.push({ id: t.id as string, open, current, delta: d })
      }
    }

    const topicMap = new Map(topics.map((t) => [t.id as string, t]))

    const momentumUp = deltaRows
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 6)
      .map((r) => {
        const t = topicMap.get(r.id)!
        const m = toMarket(t, 'momentum_up')
        m.delta_24h = r.delta
        return m
      })

    const momentumDown = deltaRows
      .filter((r) => r.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 6)
      .map((r) => {
        const t = topicMap.get(r.id)!
        const m = toMarket(t, 'momentum_down')
        m.delta_24h = r.delta
        return m
      })

    // ── Build groups (omit empty ones) ────────────────────────────────────────
    const rawGroups: Array<{ type: SignalType; markets: SignalMarket[] }> = [
      { type: 'near_law', markets: nearLaw },
      { type: 'momentum_up', markets: momentumUp },
      { type: 'momentum_down', markets: momentumDown },
      { type: 'contested', markets: contested },
      { type: 'strong_for', markets: strongFor },
      { type: 'near_failure', markets: nearFailure },
      { type: 'high_volume', markets: highVolume },
    ]

    const groups: SignalGroup[] = rawGroups
      .filter((g) => g.markets.length > 0)
      .map((g) => ({
        type: g.type,
        label: SIGNAL_META[g.type].label,
        description: SIGNAL_META[g.type].description,
        markets: g.markets,
      }))

    return NextResponse.json({
      groups,
      as_of: new Date().toISOString(),
    } satisfies SignalsResponse)
  } catch (err) {
    console.error('[/api/exchange/signals]', err)
    return NextResponse.json(
      { groups: [], as_of: new Date().toISOString() },
      { status: 500 },
    )
  }
}
