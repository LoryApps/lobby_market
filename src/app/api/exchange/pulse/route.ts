import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryVital {
  category: string
  avg_price: number
  market_count: number
  total_volume: number
  health: 'strong' | 'moderate' | 'contested' | 'resistant'
  direction: 'rising' | 'falling' | 'stable'
  hot_topic_id: string | null
  hot_topic_statement: string | null
}

export interface ThresholdMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  threshold: 25 | 50 | 75
  distance: number  // pts to threshold
  direction: 'approaching' | 'retreating'
  volume: number
  label: string     // e.g. "3pts from Law"
}

export interface HotMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
  feed_score: number
  delta_24h: number | null
  is_near_law: boolean
  is_deadlocked: boolean
}

export interface PulseVitals {
  overall_consensus: number        // avg blue_pct across active markets
  total_volume: number             // sum of all total_votes
  active_markets: number           // count of active/voting topics
  laws_today: number               // topics that became law today
  contested_markets: number        // within 10% of 50/50
  near_law_markets: number         // >= 67% consensus
  total_arguments_today: number    // arguments posted today
  sentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish'
  breadth_pct: number              // % of markets advancing (>50%)
}

export interface PulseResponse {
  vitals: PulseVitals
  category_vitals: CategoryVital[]
  threshold_watch: ThresholdMarket[]
  hot_markets: HotMarket[]
  as_of: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

function health(avgPrice: number): CategoryVital['health'] {
  if (avgPrice >= 65) return 'strong'
  if (avgPrice >= 52) return 'moderate'
  if (avgPrice >= 45) return 'contested'
  return 'resistant'
}

function sentimentLabel(overall: number): PulseVitals['sentiment'] {
  if (overall >= 68) return 'very_bullish'
  if (overall >= 57) return 'bullish'
  if (overall >= 43) return 'neutral'
  if (overall >= 32) return 'bearish'
  return 'very_bearish'
}

function thresholdLabel(threshold: 25 | 50 | 75, price: number): string {
  const dist = Math.abs(price - threshold)
  if (threshold === 75) return `${dist}¢ from Law`
  if (threshold === 50) return `${dist}¢ from Majority`
  return `${dist}¢ from Dissent`
}

function fallback(): PulseResponse {
  return {
    vitals: {
      overall_consensus: 50,
      total_volume: 0,
      active_markets: 0,
      laws_today: 0,
      contested_markets: 0,
      near_law_markets: 0,
      total_arguments_today: 0,
      sentiment: 'neutral',
      breadth_pct: 50,
    },
    category_vitals: [],
    threshold_watch: [],
    hot_markets: [],
    as_of: new Date().toISOString(),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    // 1. Fetch all non-proposed topics with key metrics
    const { data: topics, error: tErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at, updated_at')
      .neq('status', 'proposed')
      .limit(500)

    if (tErr || !topics) return NextResponse.json(fallback())

    // 2. Laws passed today
    const { count: lawsToday } = await supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'law')
      .gte('updated_at', todayStart.toISOString())

    // 3. Arguments posted today
    const { count: argsToday } = await supabase
      .from('arguments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())

    // 4. Get 24h price history for delta computation
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: history } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, recorded_at')
      .gte('recorded_at', since24h)
      .order('recorded_at', { ascending: true })

    // Build 24h delta map (oldest snapshot in window → compare to current)
    const oldestByTopic = new Map<string, number>()
    if (history) {
      for (const row of history) {
        const id = row.topic_id as string
        if (!oldestByTopic.has(id)) {
          oldestByTopic.set(id, row.price as number)
        }
      }
    }

    // ── Vitals ────────────────────────────────────────────────────────────────

    const activeTopics = topics.filter(t => t.status === 'active' || t.status === 'voting')
    const totalVol = topics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
    const overallConsensus = activeTopics.length > 0
      ? Math.round(activeTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / activeTopics.length)
      : 50
    const contestedCount = activeTopics.filter(t => Math.abs((t.blue_pct ?? 50) - 50) <= 10).length
    const nearLawCount = activeTopics.filter(t => (t.blue_pct ?? 0) >= 67).length
    const advancingCount = activeTopics.filter(t => (t.blue_pct ?? 50) > 50).length
    const breadthPct = activeTopics.length > 0
      ? Math.round((advancingCount / activeTopics.length) * 100)
      : 50

    const vitals: PulseVitals = {
      overall_consensus: overallConsensus,
      total_volume: totalVol,
      active_markets: activeTopics.length,
      laws_today: lawsToday ?? 0,
      contested_markets: contestedCount,
      near_law_markets: nearLawCount,
      total_arguments_today: argsToday ?? 0,
      sentiment: sentimentLabel(overallConsensus),
      breadth_pct: breadthPct,
    }

    // ── Category Vitals ───────────────────────────────────────────────────────

    const byCategory = new Map<string, typeof activeTopics>()
    for (const cat of CATEGORIES) byCategory.set(cat, [])

    for (const t of activeTopics) {
      const cat = (t.category as string | null) ?? 'Other'
      if (byCategory.has(cat)) byCategory.get(cat)!.push(t)
    }

    const category_vitals: CategoryVital[] = CATEGORIES
      .map(cat => {
        const ts = byCategory.get(cat) ?? []
        if (ts.length === 0) return null
        const avgPrice = Math.round(ts.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / ts.length)
        const totalVol = ts.reduce((s, t) => s + (t.total_votes ?? 0), 0)

        // Direction from 24h delta of topics in this category
        let rising = 0, falling = 0
        for (const t of ts) {
          const old = oldestByTopic.get(t.id)
          if (old == null) continue
          const delta = (t.blue_pct ?? 50) - old
          if (delta > 0.5) rising++
          else if (delta < -0.5) falling++
        }
        const direction: CategoryVital['direction'] =
          rising > falling ? 'rising' : falling > rising ? 'falling' : 'stable'

        // Hottest topic in this category
        const hotTopic = ts.sort((a, b) => (b.feed_score ?? 0) - (a.feed_score ?? 0))[0]

        return {
          category: cat,
          avg_price: avgPrice,
          market_count: ts.length,
          total_volume: totalVol,
          health: health(avgPrice),
          direction,
          hot_topic_id: hotTopic?.id ?? null,
          hot_topic_statement: hotTopic?.statement ?? null,
        } satisfies CategoryVital
      })
      .filter((v): v is CategoryVital => v !== null)

    // ── Threshold Watch ───────────────────────────────────────────────────────

    const thresholdTargets = [25, 50, 75] as const
    const threshold_watch: ThresholdMarket[] = []

    for (const topic of activeTopics) {
      const price = topic.blue_pct ?? 50
      for (const thr of thresholdTargets) {
        const dist = Math.abs(price - thr)
        if (dist <= 6 && dist > 0) {
          threshold_watch.push({
            id: topic.id,
            statement: topic.statement,
            category: topic.category as string | null,
            status: topic.status,
            price,
            threshold: thr,
            distance: Math.round(dist * 10) / 10,
            direction: price < thr ? 'approaching' : 'retreating',
            volume: topic.total_votes ?? 0,
            label: thresholdLabel(thr, price),
          })
          break // only assign to nearest threshold
        }
      }
    }

    // Sort by distance ascending, cap at 12
    threshold_watch.sort((a, b) => a.distance - b.distance)
    threshold_watch.splice(12)

    // ── Hot Markets ───────────────────────────────────────────────────────────

    const hot_markets: HotMarket[] = activeTopics
      .sort((a, b) => (b.feed_score ?? 0) - (a.feed_score ?? 0))
      .slice(0, 8)
      .map(t => {
        const oldPrice = oldestByTopic.get(t.id) ?? null
        const delta24h = oldPrice != null
          ? Math.round(((t.blue_pct ?? 50) - oldPrice) * 10) / 10
          : null
        return {
          id: t.id,
          statement: t.statement,
          category: t.category as string | null,
          status: t.status,
          price: t.blue_pct ?? 50,
          volume: t.total_votes ?? 0,
          feed_score: t.feed_score ?? 0,
          delta_24h: delta24h,
          is_near_law: (t.blue_pct ?? 0) >= 67,
          is_deadlocked: Math.abs((t.blue_pct ?? 50) - 50) <= 5,
        }
      })

    return NextResponse.json({
      vitals,
      category_vitals,
      threshold_watch,
      hot_markets,
      as_of: new Date().toISOString(),
    } satisfies PulseResponse)
  } catch (err) {
    console.error('[pulse]', err)
    return NextResponse.json(fallback())
  }
}
