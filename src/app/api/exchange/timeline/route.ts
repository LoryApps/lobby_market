import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'new_market'
  | 'went_active'
  | 'went_voting'
  | 'became_law'
  | 'market_failed'
  | 'near_law'
  | 'price_surge'
  | 'price_drop'
  | 'high_volume'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  price_delta?: number
  total_votes?: number
  occurred_at: string
}

export interface TimelineResponse {
  events: TimelineEvent[]
  as_of: string
  window_hours: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MILESTONE_PRICES = [25, 33, 50, 66, 75, 90]

function detectedMilestone(prev: number, next: number): number | null {
  for (const m of MILESTONE_PRICES) {
    if (prev < m && next >= m) return m
    if (prev > (100 - m) && next <= (100 - m)) return -(100 - m)
  }
  return null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const windowHours = Math.min(
    168, // max 7 days
    Math.max(1, parseInt(searchParams.get('hours') ?? '48', 10)),
  )
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '60', 10)))
  const filterType = searchParams.get('type') ?? null

  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
    const events: TimelineEvent[] = []

    // ── 1. New markets created ────────────────────────────────────────────────
    if (!filterType || filterType === 'new_market') {
      const { data: newMarkets } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, created_at')
        .gte('created_at', since)
        .not('status', 'eq', 'proposed')
        .order('created_at', { ascending: false })
        .limit(20)

      for (const t of newMarkets ?? []) {
        events.push({
          id: `new_${t.id}`,
          type: 'new_market',
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          occurred_at: t.created_at,
        })
      }
    }

    // ── 2. Status changes (active, voting, law, failed) ────────────────────
    if (!filterType || filterType === 'went_active') {
      const { data: active } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at')
        .eq('status', 'active')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(15)

      for (const t of active ?? []) {
        events.push({
          id: `active_${t.id}`,
          type: 'went_active',
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          occurred_at: t.updated_at,
        })
      }
    }

    if (!filterType || filterType === 'went_voting') {
      const { data: voting } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at')
        .eq('status', 'voting')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(15)

      for (const t of voting ?? []) {
        events.push({
          id: `voting_${t.id}`,
          type: 'went_voting',
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          occurred_at: t.updated_at,
        })
      }
    }

    if (!filterType || filterType === 'became_law') {
      const { data: laws } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at')
        .eq('status', 'law')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(15)

      for (const t of laws ?? []) {
        events.push({
          id: `law_${t.id}`,
          type: 'became_law',
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          occurred_at: t.updated_at,
        })
      }
    }

    if (!filterType || filterType === 'market_failed') {
      const { data: failed } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at')
        .eq('status', 'failed')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(10)

      for (const t of failed ?? []) {
        events.push({
          id: `failed_${t.id}`,
          type: 'market_failed',
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          occurred_at: t.updated_at,
        })
      }
    }

    // ── 3. Near-law markets (currently above 66¢) ──────────────────────────
    if (!filterType || filterType === 'near_law') {
      const { data: nearLaw } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at')
        .eq('status', 'active')
        .gte('blue_pct', 66)
        .order('blue_pct', { ascending: false })
        .limit(10)

      for (const t of nearLaw ?? []) {
        events.push({
          id: `nearlaw_${t.id}`,
          type: 'near_law',
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          occurred_at: t.updated_at,
        })
      }
    }

    // ── 4. Price milestones from price history ─────────────────────────────
    if (!filterType || filterType === 'price_surge' || filterType === 'price_drop') {
      const priceSince = new Date(Date.now() - Math.min(windowHours, 48) * 60 * 60 * 1000).toISOString()
      const { data: priceHistory } = await supabase
        .from('topic_price_history')
        .select('topic_id, price, volume, recorded_at')
        .gte('recorded_at', priceSince)
        .order('recorded_at', { ascending: true })

      if (priceHistory && priceHistory.length > 0) {
        // Group by topic and find significant moves
        type Snapshot = { price: number; volume: number; recorded_at: string }
        const byTopic = new Map<string, Snapshot[]>()

        for (const row of priceHistory) {
          const id = row.topic_id as string
          if (!byTopic.has(id)) byTopic.set(id, [])
          byTopic.get(id)!.push({
            price: row.price as number,
            volume: row.volume as number,
            recorded_at: row.recorded_at as string,
          })
        }

        // For each topic, detect milestone crossings and large moves
        const topicIds = Array.from(byTopic.keys())
        if (topicIds.length > 0) {
          const { data: topicMeta } = await supabase
            .from('topics')
            .select('id, statement, category, status, blue_pct, total_votes')
            .in('id', topicIds)

          const metaMap = new Map((topicMeta ?? []).map((t) => [t.id, t]))

          for (const [id, snaps] of byTopic.entries()) {
            const meta = metaMap.get(id)
            if (!meta) continue

            // Detect milestone crossings
            for (let i = 1; i < snaps.length; i++) {
              const prev = snaps[i - 1].price
              const curr = snaps[i].price
              const milestone = detectedMilestone(prev, curr)
              const delta = curr - prev

              if (milestone !== null && (!filterType || filterType === (delta > 0 ? 'price_surge' : 'price_drop'))) {
                events.push({
                  id: `milestone_${id}_${snaps[i].recorded_at}`,
                  type: delta > 0 ? 'price_surge' : 'price_drop',
                  topic_id: id,
                  statement: meta.statement,
                  category: meta.category,
                  status: meta.status,
                  current_price: Math.round(meta.blue_pct ?? 50),
                  price_delta: Math.round(delta * 10) / 10,
                  total_votes: meta.total_votes ?? 0,
                  occurred_at: snaps[i].recorded_at,
                })
              }
            }

            // Detect big 24h moves (>=10 point swing across the full window)
            if (snaps.length >= 2) {
              const first = snaps[0]
              const last = snaps[snaps.length - 1]
              const swing = last.price - first.price

              if (Math.abs(swing) >= 10) {
                const type = swing > 0 ? 'price_surge' : 'price_drop'
                if (!filterType || filterType === type) {
                  const eventId = `swing_${id}_${last.recorded_at}`
                  const alreadyAdded = events.some((e) => e.id.startsWith(`milestone_${id}`))
                  if (!alreadyAdded) {
                    events.push({
                      id: eventId,
                      type,
                      topic_id: id,
                      statement: meta.statement,
                      category: meta.category,
                      status: meta.status,
                      current_price: Math.round(meta.blue_pct ?? 50),
                      price_delta: Math.round(swing * 10) / 10,
                      total_votes: meta.total_votes ?? 0,
                      occurred_at: last.recorded_at,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    // ── 5. High-volume markets (recent activity, lots of votes) ───────────
    if (!filterType || filterType === 'high_volume') {
      const { data: highVol } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at')
        .not('status', 'in', '("proposed","law","failed")')
        .gte('total_votes', 100)
        .gte('updated_at', since)
        .order('total_votes', { ascending: false })
        .limit(10)

      for (const t of highVol ?? []) {
        events.push({
          id: `vol_${t.id}`,
          type: 'high_volume',
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          current_price: Math.round(t.blue_pct ?? 50),
          total_votes: t.total_votes ?? 0,
          occurred_at: t.updated_at,
        })
      }
    }

    // ── Deduplicate by topic_id (keep highest-priority event per topic) ────
    const PRIORITY: Record<TimelineEventType, number> = {
      became_law: 0,
      market_failed: 1,
      went_voting: 2,
      price_surge: 3,
      price_drop: 4,
      near_law: 5,
      went_active: 6,
      new_market: 7,
      high_volume: 8,
    }

    const seen = new Map<string, TimelineEvent>()
    for (const evt of events) {
      const existing = seen.get(evt.topic_id)
      if (!existing || PRIORITY[evt.type] < PRIORITY[existing.type]) {
        seen.set(evt.topic_id, evt)
      }
    }

    const sorted = Array.from(seen.values())
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, limit)

    return NextResponse.json({
      events: sorted,
      as_of: new Date().toISOString(),
      window_hours: windowHours,
    } satisfies TimelineResponse)
  } catch (err) {
    console.error('[/api/exchange/timeline]', err)
    return NextResponse.json(
      { events: [], as_of: new Date().toISOString(), window_hours: windowHours },
      { status: 500 },
    )
  }
}
