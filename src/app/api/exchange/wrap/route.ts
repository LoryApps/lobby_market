import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WrapMove {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  open_price: number
  delta: number
  delta_pct: number
  volume: number
  vol_delta: number
  is_near_law: boolean
}

export interface CategoryWrap {
  category: string
  avg_consensus: number
  market_count: number
  active_count: number
  law_count: number
  total_volume: number
  color: string
}

export interface DailyEvent {
  type: 'became_law' | 'failed' | 'entered_voting' | 'big_move_up' | 'big_move_down'
  id: string
  statement: string
  category: string | null
  price: number
  detail: string
}

export interface MarketSentiment {
  total_markets: number
  advancing: number
  declining: number
  unchanged: number
  avg_consensus: number
  total_volume: number
  breadth: number
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed'
}

export interface WrapResponse {
  date: string
  sentiment: MarketSentiment
  gainers: WrapMove[]
  losers: WrapMove[]
  most_active: WrapMove[]
  categories: CategoryWrap[]
  events: DailyEvent[]
  headline: string
  as_of: string
}

// ─── Category color map ───────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'gold',
  Politics: 'for',
  Technology: 'purple',
  Science: 'emerald',
  Ethics: 'against',
  Philosophy: 'surface',
  Culture: 'gold',
  Health: 'emerald',
  Environment: 'emerald',
  Education: 'for',
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Headline generator ───────────────────────────────────────────────────────

function buildHeadline(sentiment: MarketSentiment, events: DailyEvent[]): string {
  const lawEvents = events.filter((e) => e.type === 'became_law')
  const failedEvents = events.filter((e) => e.type === 'failed')
  const bigMoves = events.filter((e) => e.type === 'big_move_up' || e.type === 'big_move_down')

  if (lawEvents.length > 0) {
    const law = lawEvents[0]
    const cat = law.category ? `${law.category}: ` : ''
    return `${cat}"${law.statement.slice(0, 60)}${law.statement.length > 60 ? '…' : ''}" reaches law status`
  }
  if (sentiment.sentiment === 'bullish' && bigMoves.length > 0) {
    const move = bigMoves[0]
    return `Market rallies — ${move.statement.slice(0, 60)}${move.statement.length > 60 ? '…' : ''} leads gains`
  }
  if (sentiment.sentiment === 'bearish') {
    return `Markets retreat — ${sentiment.declining} of ${sentiment.total_markets} markets in decline today`
  }
  if (failedEvents.length > 0) {
    return `${failedEvents.length} proposal${failedEvents.length === 1 ? '' : 's'} fail${failedEvents.length === 1 ? 's' : ''} to reach consensus today`
  }
  if (sentiment.sentiment === 'bullish') {
    return `Markets advance — ${Math.round(sentiment.breadth * 100)}% of markets moving FOR today`
  }
  return `Markets mixed — ${sentiment.total_markets} markets active with ${sentiment.total_volume.toLocaleString()} total votes`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const today = new Date()
    const dateLabel = today.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // ── 1. All active/voting/resolved topics ──────────────────────────────────
    const { data: allTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(200)

    // ── 2. Price history for the last 24h ─────────────────────────────────────
    const { data: history } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, volume, recorded_at')
      .gte('recorded_at', since24h)
      .order('recorded_at', { ascending: true })

    // ── 3. Recent events (laws + failures in last 24h) ────────────────────────
    const { data: recentLaws } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct')
      .eq('status', 'law')
      .gte('updated_at', since24h)
      .order('updated_at', { ascending: false })
      .limit(5)

    const { data: recentFailed } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct')
      .eq('status', 'failed')
      .gte('updated_at', since24h)
      .order('updated_at', { ascending: false })
      .limit(5)

    const { data: recentVoting } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct')
      .eq('status', 'voting')
      .gte('updated_at', since24h)
      .order('updated_at', { ascending: false })
      .limit(3)

    // ── Compute price moves from history ──────────────────────────────────────
    type PriceAcc = {
      open_price: number
      close_price: number
      open_volume: number
      close_volume: number
    }
    const byTopic = new Map<string, PriceAcc>()

    for (const row of history ?? []) {
      const id = row.topic_id as string
      const price = row.price as number
      const volume = row.volume as number
      if (!byTopic.has(id)) {
        byTopic.set(id, { open_price: price, close_price: price, open_volume: volume, close_volume: volume })
      } else {
        const acc = byTopic.get(id)!
        acc.close_price = price
        acc.close_volume = volume
      }
    }

    // ── Build move objects ────────────────────────────────────────────────────
    const moves: WrapMove[] = (allTopics ?? [])
      .filter((t) => t.status === 'active' || t.status === 'voting')
      .map((t) => {
        const acc = byTopic.get(t.id)
        const currentPrice = Math.round(t.blue_pct ?? 50)
        const openPrice = acc ? Math.round(acc.open_price) : currentPrice
        const delta = currentPrice - openPrice
        const openSafe = openPrice === 0 ? 1 : openPrice
        const delta_pct = Math.round((delta / openSafe) * 1000) / 10
        const volDelta = acc ? Math.max(0, acc.close_volume - acc.open_volume) : 0

        return {
          id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: currentPrice,
          open_price: openPrice,
          delta,
          delta_pct,
          volume: t.total_votes ?? 0,
          vol_delta: volDelta,
          is_near_law: currentPrice >= 65,
        }
      })

    // ── Market sentiment ──────────────────────────────────────────────────────
    const advancing = moves.filter((m) => m.delta > 0).length
    const declining = moves.filter((m) => m.delta < 0).length
    const unchanged = moves.length - advancing - declining
    const avgConsensus = moves.length > 0
      ? Math.round(moves.reduce((s, m) => s + m.current_price, 0) / moves.length)
      : 50
    const totalVolume = (allTopics ?? []).reduce((s, t) => s + (t.total_votes ?? 0), 0)
    const breadth = moves.length > 0 ? advancing / moves.length : 0.5

    let sentimentLabel: MarketSentiment['sentiment'] = 'neutral'
    if (breadth > 0.6) sentimentLabel = 'bullish'
    else if (breadth < 0.4) sentimentLabel = 'bearish'
    else if (Math.abs(breadth - 0.5) < 0.05) sentimentLabel = 'mixed'

    const sentiment: MarketSentiment = {
      total_markets: moves.length,
      advancing,
      declining,
      unchanged,
      avg_consensus: avgConsensus,
      total_volume: totalVolume,
      breadth,
      sentiment: sentimentLabel,
    }

    // ── Sorted slices ─────────────────────────────────────────────────────────
    const gainers = [...moves]
      .filter((m) => m.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5)

    const losers = [...moves]
      .filter((m) => m.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5)

    const most_active = [...moves]
      .sort((a, b) => b.vol_delta - a.vol_delta)
      .slice(0, 5)

    // ── Category breakdown ────────────────────────────────────────────────────
    const catMap = new Map<string, { prices: number[]; volume: number; active: number; law: number }>()
    for (const cat of CATEGORIES) {
      catMap.set(cat, { prices: [], volume: 0, active: 0, law: 0 })
    }

    for (const t of allTopics ?? []) {
      const cat = t.category
      if (!cat || !catMap.has(cat)) continue
      const entry = catMap.get(cat)!
      entry.prices.push(t.blue_pct ?? 50)
      entry.volume += t.total_votes ?? 0
      if (t.status === 'active' || t.status === 'voting') entry.active += 1
      if (t.status === 'law') entry.law += 1
    }

    const categories: CategoryWrap[] = CATEGORIES
      .map((cat) => {
        const entry = catMap.get(cat)!
        const avg = entry.prices.length > 0
          ? Math.round(entry.prices.reduce((s, p) => s + p, 0) / entry.prices.length)
          : 50
        return {
          category: cat,
          avg_consensus: avg,
          market_count: entry.prices.length,
          active_count: entry.active,
          law_count: entry.law,
          total_volume: entry.volume,
          color: CAT_COLOR[cat] ?? 'surface',
        }
      })
      .filter((c) => c.market_count > 0)
      .sort((a, b) => b.total_volume - a.total_volume)

    // ── Notable events ────────────────────────────────────────────────────────
    const events: DailyEvent[] = []

    for (const t of recentLaws ?? []) {
      events.push({
        type: 'became_law',
        id: t.id,
        statement: t.statement,
        category: t.category,
        price: Math.round(t.blue_pct ?? 50),
        detail: `Achieved consensus at ${Math.round(t.blue_pct ?? 50)}% FOR`,
      })
    }

    for (const t of recentFailed ?? []) {
      events.push({
        type: 'failed',
        id: t.id,
        statement: t.statement,
        category: t.category,
        price: Math.round(t.blue_pct ?? 50),
        detail: `Failed with ${Math.round(t.blue_pct ?? 50)}% FOR`,
      })
    }

    for (const t of recentVoting ?? []) {
      events.push({
        type: 'entered_voting',
        id: t.id,
        statement: t.statement,
        category: t.category,
        price: Math.round(t.blue_pct ?? 50),
        detail: `Now in voting phase at ${Math.round(t.blue_pct ?? 50)}% FOR`,
      })
    }

    // Add big movers as events
    for (const m of gainers.slice(0, 2)) {
      if (m.delta >= 5) {
        events.push({
          type: 'big_move_up',
          id: m.id,
          statement: m.statement,
          category: m.category,
          price: m.current_price,
          detail: `+${m.delta}pt move — up from ${m.open_price}¢ to ${m.current_price}¢`,
        })
      }
    }
    for (const m of losers.slice(0, 2)) {
      if (m.delta <= -5) {
        events.push({
          type: 'big_move_down',
          id: m.id,
          statement: m.statement,
          category: m.category,
          price: m.current_price,
          detail: `${m.delta}pt move — down from ${m.open_price}¢ to ${m.current_price}¢`,
        })
      }
    }

    const headline = buildHeadline(sentiment, events)

    return NextResponse.json({
      date: dateLabel,
      sentiment,
      gainers,
      losers,
      most_active,
      categories,
      events,
      headline,
      as_of: new Date().toISOString(),
    } satisfies WrapResponse)
  } catch (err) {
    console.error('[/api/exchange/wrap]', err)
    const fallback: WrapResponse = {
      date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      sentiment: {
        total_markets: 0,
        advancing: 0,
        declining: 0,
        unchanged: 0,
        avg_consensus: 50,
        total_volume: 0,
        breadth: 0.5,
        sentiment: 'neutral',
      },
      gainers: [],
      losers: [],
      most_active: [],
      categories: [],
      events: [],
      headline: 'Market data temporarily unavailable',
      as_of: new Date().toISOString(),
    }
    return NextResponse.json(fallback, { status: 500 })
  }
}
