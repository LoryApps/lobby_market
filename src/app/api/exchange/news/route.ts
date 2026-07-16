import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type NewsEventType =
  | 'became_law'
  | 'entered_voting'
  | 'activated'
  | 'failed'
  | 'price_milestone'
  | 'volume_surge'
  | 'closing_soon'
  | 'new_consensus_high'
  | 'deadlocked'

export interface NewsEvent {
  id: string
  topic_id: string
  statement: string
  category: string | null
  type: NewsEventType
  headline: string
  detail: string
  price: number
  volume: number
  occurred_at: string
  is_breaking: boolean
}

export interface NewsResponse {
  events: NewsEvent[]
  total: number
  as_of: string
  window_hours: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// Milestone thresholds (descending order for first-match priority)
const MILESTONES = [80, 70, 65, 60, 55, 45, 40, 35, 30, 20] as const

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const windowHours = Math.min(
      parseInt(searchParams.get('window') ?? '24', 10),
      168 // max 7 days
    )

    const supabase = await createClient()
    const windowStart = new Date(Date.now() - windowHours * 3_600_000).toISOString()
    const breakingCutoff = new Date(Date.now() - 3_600_000).toISOString() // last 1h = breaking

    const events: NewsEvent[] = []

    // ── 1. Status transitions in the window ─────────────────────────────────
    let statusQ = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at, created_at')
      .gte('updated_at', windowStart)
      .in('status', ['law', 'voting', 'active', 'failed'])
      .order('updated_at', { ascending: false })
      .limit(50)

    if (category && category !== 'All') {
      statusQ = statusQ.eq('category', category)
    }

    const { data: statusTopics } = await statusQ

    for (const t of statusTopics ?? []) {
      const price = Math.round(t.blue_pct ?? 50)
      const vol = t.total_votes ?? 0
      const updAt = t.updated_at ?? t.created_at ?? new Date().toISOString()
      const isBreaking = updAt >= breakingCutoff

      if (t.status === 'law') {
        events.push({
          id: `law-${t.id}`,
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          type: 'became_law',
          headline: `🏛️ LAW ESTABLISHED`,
          detail: `"${truncate(t.statement, 70)}" has achieved consensus and entered the Codex.`,
          price,
          volume: vol,
          occurred_at: updAt,
          is_breaking: isBreaking,
        })
      } else if (t.status === 'voting') {
        events.push({
          id: `voting-${t.id}`,
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          type: 'entered_voting',
          headline: `⚖️ ENTERED VOTING`,
          detail: `"${truncate(t.statement, 70)}" has reached the voting phase at ${price}¢.`,
          price,
          volume: vol,
          occurred_at: updAt,
          is_breaking: isBreaking,
        })
      } else if (t.status === 'active') {
        events.push({
          id: `active-${t.id}`,
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          type: 'activated',
          headline: `⚡ MARKET ACTIVATED`,
          detail: `"${truncate(t.statement, 70)}" is now active — trading opens at ${price}¢.`,
          price,
          volume: vol,
          occurred_at: updAt,
          is_breaking: isBreaking,
        })
      } else if (t.status === 'failed') {
        events.push({
          id: `failed-${t.id}`,
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          type: 'failed',
          headline: `✗ MARKET CLOSED`,
          detail: `"${truncate(t.statement, 70)}" settled against consensus at ${price}¢.`,
          price,
          volume: vol,
          occurred_at: updAt,
          is_breaking: isBreaking,
        })
      }
    }

    // ── 2. Closing-soon alerts (voting ends in next 12h) ────────────────────
    const closingCutoff = new Date(Date.now() + 12 * 3_600_000).toISOString()
    let closingQ = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at')
      .eq('status', 'voting')
      .not('voting_ends_at', 'is', null)
      .lte('voting_ends_at', closingCutoff)
      .gte('voting_ends_at', new Date().toISOString())
      .order('voting_ends_at', { ascending: true })
      .limit(10)

    if (category && category !== 'All') {
      closingQ = closingQ.eq('category', category)
    }

    const { data: closingTopics } = await closingQ

    for (const t of closingTopics ?? []) {
      const price = Math.round(t.blue_pct ?? 50)
      const endsAt = t.voting_ends_at!
      const msLeft = new Date(endsAt).getTime() - Date.now()
      const hLeft = Math.floor(msLeft / 3_600_000)
      const mLeft = Math.floor((msLeft % 3_600_000) / 60_000)
      const timeStr = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`
      const isBreaking = hLeft < 1

      events.push({
        id: `closing-${t.id}`,
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        type: 'closing_soon',
        headline: `⏱ CLOSING IN ${timeStr.toUpperCase()}`,
        detail: `"${truncate(t.statement, 70)}" is settling at ${price}¢. Final votes being counted.`,
        price,
        volume: t.total_votes ?? 0,
        occurred_at: new Date().toISOString(),
        is_breaking: isBreaking,
      })
    }

    // ── 3. Price milestone crossings via topic_price_history ────────────────
    // Get pairs of (previous, current) snapshots to detect threshold crossings
    const { data: recentHistory } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, volume, recorded_at')
      .gte('recorded_at', windowStart)
      .order('recorded_at', { ascending: false })
      .limit(500)

    if (recentHistory && recentHistory.length > 0) {
      // Group by topic_id, keeping most recent + one-before-most-recent
      const byTopic = new Map<string, { current: typeof recentHistory[0]; prev: typeof recentHistory[0] | null }>()

      for (const row of recentHistory) {
        const existing = byTopic.get(row.topic_id)
        if (!existing) {
          byTopic.set(row.topic_id, { current: row, prev: null })
        } else if (!existing.prev) {
          byTopic.set(row.topic_id, { current: existing.current, prev: row })
        }
      }

      // For topics with 2+ snapshots, look for milestone crossings
      const topicIdsWithHistory = [...byTopic.entries()]
        .filter(([, v]) => v.prev !== null)
        .map(([id]) => id)

      let topicMeta: Array<{ id: string; statement: string; category: string | null }> = []
      if (topicIdsWithHistory.length > 0) {
        const topicMetaQ = supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', topicIdsWithHistory.slice(0, 100))
        if (category && category !== 'All') {
          topicMetaQ.eq('category', category)
        }
        const { data } = await topicMetaQ
        topicMeta = data ?? []
      }

      const topicMetaMap = new Map(topicMeta.map((t) => [t.id, t]))

      for (const [topicId, { current, prev }] of byTopic) {
        if (!prev) continue
        const meta = topicMetaMap.get(topicId)
        if (!meta) continue

        const oldPrice = prev.price
        const newPrice = current.price

        for (const milestone of MILESTONES) {
          const crossed =
            (oldPrice < milestone && newPrice >= milestone) ||
            (oldPrice > (100 - milestone) && newPrice <= (100 - milestone))

          if (crossed) {
            const isUp = newPrice > oldPrice
            const milestoneLabel = isUp ? milestone : 100 - milestone
            const isBreaking = current.recorded_at >= breakingCutoff

            events.push({
              id: `milestone-${topicId}-${milestone}-${isUp ? 'up' : 'dn'}`,
              topic_id: topicId,
              statement: meta.statement,
              category: meta.category,
              type: 'price_milestone',
              headline: `${isUp ? '↑' : '↓'} PRICE CROSSES ${milestoneLabel}¢`,
              detail: `"${truncate(meta.statement, 70)}" moved from ${Math.round(oldPrice)}¢ to ${Math.round(newPrice)}¢, crossing the ${milestoneLabel}¢ threshold.`,
              price: Math.round(newPrice),
              volume: current.volume,
              occurred_at: current.recorded_at,
              is_breaking: isBreaking,
            })
            break // only report the highest-priority milestone per topic
          }
        }
      }
    }

    // ── 4. High-volume topics (deadlocked near 50%) ──────────────────────
    let deadlockQ = supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, updated_at')
      .gte('updated_at', windowStart)
      .in('status', ['active', 'voting'])
      .gte('blue_pct', 45)
      .lte('blue_pct', 55)
      .gte('total_votes', 50)
      .order('total_votes', { ascending: false })
      .limit(5)

    if (category && category !== 'All') {
      deadlockQ = deadlockQ.eq('category', category)
    }

    const { data: deadlockTopics } = await deadlockQ

    for (const t of deadlockTopics ?? []) {
      const price = Math.round(t.blue_pct ?? 50)
      const updAt = t.updated_at ?? new Date().toISOString()
      const isBreaking = updAt >= breakingCutoff

      events.push({
        id: `deadlock-${t.id}`,
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        type: 'deadlocked',
        headline: `⚖️ MARKET DEADLOCKED`,
        detail: `"${truncate(t.statement, 70)}" is evenly split at ${price}¢ with ${(t.total_votes ?? 0).toLocaleString()} votes. The outcome is uncertain.`,
        price,
        volume: t.total_votes ?? 0,
        occurred_at: updAt,
        is_breaking: isBreaking,
      })
    }

    // ── Deduplicate and sort by recency ──────────────────────────────────────
    const seen = new Set<string>()
    const uniqueEvents = events
      .filter((e) => {
        const key = e.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, 50)

    const response: NewsResponse = {
      events: uniqueEvents,
      total: uniqueEvents.length,
      as_of: new Date().toISOString(),
      window_hours: windowHours,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[/api/exchange/news]', err)
    return NextResponse.json(
      { events: [], total: 0, as_of: new Date().toISOString(), window_hours: 24 },
      { status: 500 }
    )
  }
}
