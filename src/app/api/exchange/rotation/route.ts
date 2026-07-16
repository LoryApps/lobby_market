import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RotationPhase =
  | 'leading'        // High momentum + high consensus — strong category
  | 'weakening'      // High consensus but losing momentum — may peak
  | 'recovering'     // Low consensus but gaining momentum — improving
  | 'lagging'        // Low consensus + low momentum — weak category

export interface TopicRef {
  id: string
  statement: string
  price: number
  status: string
}

export interface CategorySnapshot {
  category: string
  current_avg_price: number   // avg blue_pct across live topics
  prev_avg_price: number      // avg blue_pct 7 days ago
  momentum: number            // change in avg price (current - prev)
  topic_count: number
  active_topic_count: number
  avg_volume: number
  total_volume: number
  top_topic: TopicRef | null
  phase: RotationPhase
}

export interface RotationResponse {
  categories: CategorySnapshot[]
  timeframe_days: number
  as_of: string
}

// ─── Phase classification ─────────────────────────────────────────────────────

function classifyPhase(price: number, momentum: number): RotationPhase {
  const highPrice      = price >= 55
  const risingMomentum = momentum >= 1.5

  if (highPrice && risingMomentum)   return 'leading'
  if (highPrice && !risingMomentum)  return 'weakening'
  if (!highPrice && risingMomentum)  return 'recovering'
  return 'lagging'
}

// ─── Row type from Supabase ───────────────────────────────────────────────────

interface TopicRow {
  id: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number | null
  statement: string
}

// ─── GET /api/exchange/rotation ───────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // ── 1. Fetch live topics grouped by category ────────────────────────────
    const { data: rawTopics } = await supabase
      .from('topics')
      .select('id, category, status, blue_pct, total_votes, statement')
      .in('status', ['active', 'voting', 'law', 'failed'])
      .not('category', 'is', null)
      .order('total_votes', { ascending: false })

    const topics = (rawTopics ?? []) as TopicRow[]

    if (!topics.length) {
      return NextResponse.json<RotationResponse>({
        categories: [],
        timeframe_days: 7,
        as_of: new Date().toISOString(),
      })
    }

    // ── 2. Group by category ────────────────────────────────────────────────
    const catMap: Record<string, TopicRow[]> = {}
    for (const t of topics) {
      const cat = t.category ?? 'Other'
      if (!catMap[cat]) catMap[cat] = []
      catMap[cat].push(t)
    }

    // ── 3. Get 7-day-old snapshots ──────────────────────────────────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const topicIds = topics.map((t) => t.id)

    const { data: historyRows } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, recorded_at')
      .in('topic_id', topicIds)
      .gte('recorded_at', sevenDaysAgo)
      .order('recorded_at', { ascending: true })
      .limit(topicIds.length * 3)

    // Earliest snapshot per topic within the window = ~7 days ago baseline
    const oldestPriceMap: Record<string, number> = {}
    for (const row of historyRows ?? []) {
      const tid = row.topic_id as string
      if (!(tid in oldestPriceMap)) {
        oldestPriceMap[tid] = row.price as number
      }
    }

    // ── 4. Build category snapshots ──────────────────────────────────────────
    const LIVE_STATUSES = new Set(['active', 'voting'])
    const categories: CategorySnapshot[] = []

    for (const [cat, catTopics] of Object.entries(catMap)) {
      const liveTopics = catTopics.filter((t) => LIVE_STATUSES.has(t.status))

      if (liveTopics.length < 2) continue

      const currentPrices = liveTopics.map((t) => t.blue_pct ?? 50)
      const currentAvg    = currentPrices.reduce((s, p) => s + p, 0) / currentPrices.length

      const prevPrices = liveTopics.map((t) => oldestPriceMap[t.id] ?? (t.blue_pct ?? 50))
      const prevAvg    = prevPrices.reduce((s, p) => s + p, 0) / prevPrices.length

      const momentum    = currentAvg - prevAvg
      const totalVolume = liveTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0)

      const lead = liveTopics[0]
      const topTopic: TopicRef | null = lead
        ? {
            id: lead.id,
            statement: lead.statement.slice(0, 80),
            price: lead.blue_pct ?? 50,
            status: lead.status,
          }
        : null

      categories.push({
        category: cat,
        current_avg_price: Math.round(currentAvg * 10) / 10,
        prev_avg_price:    Math.round(prevAvg * 10)    / 10,
        momentum:          Math.round(momentum * 10)   / 10,
        topic_count:       catTopics.length,
        active_topic_count: liveTopics.length,
        avg_volume:        Math.round(totalVolume / liveTopics.length),
        total_volume:      totalVolume,
        top_topic:         topTopic,
        phase:             classifyPhase(currentAvg, momentum),
      })
    }

    // Sort by phase priority, then by absolute momentum
    const PHASE_ORDER: Record<RotationPhase, number> = {
      leading: 0, recovering: 1, weakening: 2, lagging: 3,
    }
    categories.sort((a, b) => {
      const po = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]
      if (po !== 0) return po
      return Math.abs(b.momentum) - Math.abs(a.momentum)
    })

    return NextResponse.json<RotationResponse>({
      categories,
      timeframe_days: 7,
      as_of: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[/api/exchange/rotation]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
