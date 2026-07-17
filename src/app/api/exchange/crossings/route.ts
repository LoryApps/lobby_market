import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CrossingDirection = 'up' | 'down'
export type CrossingThreshold = 25 | 50 | 75

export interface ThresholdCrossing {
  id: string           // topic_id
  statement: string
  category: string | null
  status: string
  threshold: CrossingThreshold
  direction: CrossingDirection
  price_before: number
  price_after: number
  current_price: number
  volume: number
  crossed_at: string   // ISO timestamp of the snapshot AFTER the crossing
  label: string        // e.g. "Approaching Law", "Majority Flip", "Deep Dissent"
}

export interface CrossingsResponse {
  crossings: ThresholdCrossing[]
  as_of: string
  window_days: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const THRESHOLDS: CrossingThreshold[] = [25, 50, 75]

function crossingLabel(threshold: CrossingThreshold, direction: CrossingDirection): string {
  if (threshold === 75 && direction === 'up') return 'Approaching Law'
  if (threshold === 75 && direction === 'down') return 'Slipping from Law'
  if (threshold === 50 && direction === 'up') return 'Majority Gained'
  if (threshold === 50 && direction === 'down') return 'Majority Lost'
  if (threshold === 25 && direction === 'up') return 'Recovering Consensus'
  return 'Deep Dissent'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const windowDays = Math.min(30, Math.max(1, parseInt(searchParams.get('days') ?? '7', 10)))

    const supabase = await createClient()
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all price history in the window, ordered ascending by topic + time
    const { data: history, error: hErr } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, volume, recorded_at')
      .gte('recorded_at', since)
      .order('topic_id', { ascending: true })
      .order('recorded_at', { ascending: true })

    if (hErr || !history || history.length === 0) {
      return NextResponse.json({
        crossings: [],
        as_of: new Date().toISOString(),
        window_days: windowDays,
      } satisfies CrossingsResponse)
    }

    // Group snapshots by topic
    type Snapshot = { price: number; volume: number; recorded_at: string }
    const byTopic = new Map<string, Snapshot[]>()
    for (const row of history) {
      const id = row.topic_id as string
      if (!byTopic.has(id)) byTopic.set(id, [])
      byTopic.get(id)!.push({
        price: row.price as number,
        volume: row.volume as number,
        recorded_at: row.recorded_at as string,
      })
    }

    // Detect threshold crossings per topic
    // A crossing = consecutive snapshots where price moves across a threshold
    // Keep only the LATEST crossing per (topic, threshold) pair to avoid duplicates
    type CrossingKey = `${string}:${CrossingThreshold}`
    const latestCrossings = new Map<
      CrossingKey,
      { price_before: number; price_after: number; crossed_at: string; direction: CrossingDirection }
    >()

    for (const [topicId, snaps] of byTopic) {
      if (snaps.length < 2) continue
      for (let i = 1; i < snaps.length; i++) {
        const prev = snaps[i - 1]
        const curr = snaps[i]
        for (const t of THRESHOLDS) {
          const crossedUp = prev.price < t && curr.price >= t
          const crossedDown = prev.price >= t && curr.price < t
          if (crossedUp || crossedDown) {
            const key: CrossingKey = `${topicId}:${t}`
            const direction: CrossingDirection = crossedUp ? 'up' : 'down'
            // Always overwrite — we want the latest crossing for this threshold
            latestCrossings.set(key, {
              price_before: Math.round(prev.price),
              price_after: Math.round(curr.price),
              crossed_at: curr.recorded_at,
              direction,
            })
          }
        }
      }
    }

    if (latestCrossings.size === 0) {
      return NextResponse.json({
        crossings: [],
        as_of: new Date().toISOString(),
        window_days: windowDays,
      } satisfies CrossingsResponse)
    }

    // Fetch current topic data for all crossed topics
    const crossedTopicIds = [...new Set(
      Array.from(latestCrossings.keys()).map((k) => k.split(':')[0])
    )]

    const { data: topicMeta } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', crossedTopicIds)

    if (!topicMeta || topicMeta.length === 0) {
      return NextResponse.json({
        crossings: [],
        as_of: new Date().toISOString(),
        window_days: windowDays,
      } satisfies CrossingsResponse)
    }

    const topicById = new Map(topicMeta.map((t) => [t.id, t]))

    // Build crossing objects
    const crossings: ThresholdCrossing[] = []
    for (const [key, cross] of latestCrossings) {
      const [topicId, threshStr] = key.split(':')
      const threshold = parseInt(threshStr, 10) as CrossingThreshold
      const topic = topicById.get(topicId)
      if (!topic) continue

      crossings.push({
        id: topicId,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        threshold,
        direction: cross.direction,
        price_before: cross.price_before,
        price_after: cross.price_after,
        current_price: Math.round(topic.blue_pct ?? 50),
        volume: topic.total_votes ?? 0,
        crossed_at: cross.crossed_at,
        label: crossingLabel(threshold, cross.direction),
      })
    }

    // Sort: most recent crossings first
    crossings.sort(
      (a, b) => new Date(b.crossed_at).getTime() - new Date(a.crossed_at).getTime()
    )

    return NextResponse.json({
      crossings,
      as_of: new Date().toISOString(),
      window_days: windowDays,
    } satisfies CrossingsResponse)
  } catch (err) {
    console.error('[/api/exchange/crossings]', err)
    return NextResponse.json(
      { crossings: [], as_of: new Date().toISOString(), window_days: 7 },
      { status: 500 },
    )
  }
}
