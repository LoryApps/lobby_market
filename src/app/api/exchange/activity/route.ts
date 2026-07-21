import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityEventType = 'trade' | 'argument' | 'crossing' | 'law'

export interface ActivityUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  ts: string

  // Topic context
  topic_id: string
  statement: string
  category: string | null
  status: string
  price: number          // current blue_pct

  // Trade fields
  side?: 'blue' | 'red'
  user?: ActivityUser

  // Argument fields
  content?: string
  upvotes?: number

  // Crossing fields
  threshold?: 25 | 50 | 75
  direction?: 'up' | 'down'
  crossing_label?: string
  price_before?: number
  price_after?: number
}

export interface ActivityStats {
  events_1h: number
  trades_1h: number
  arguments_1h: number
  active_markets: number
  top_category: string | null
}

export interface ActivityResponse {
  events: ActivityEvent[]
  stats: ActivityStats
  filter: string
  as_of: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function crossingLabel(threshold: number, direction: 'up' | 'down'): string {
  if (threshold === 75 && direction === 'up') return 'Approaching Law'
  if (threshold === 75 && direction === 'down') return 'Slipping from Law'
  if (threshold === 50 && direction === 'up') return 'Majority Gained'
  if (threshold === 50 && direction === 'down') return 'Majority Lost'
  if (threshold === 25 && direction === 'up') return 'Minority Growing'
  return 'Deep Dissent'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all'   // all | trade | argument | crossing
  const category = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  const events: ActivityEvent[] = []

  // ── Trades ──────────────────────────────────────────────────────────────────
  if (filter === 'all' || filter === 'trade') {
    const tradeLimit = filter === 'all' ? 30 : limit
    let q = supabase
      .from('votes')
      .select(`
        id,
        user_id,
        side,
        created_at,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url,
          role,
          clout
        ),
        topics:topic_id (
          id,
          statement,
          category,
          status,
          blue_pct,
          total_votes
        )
      `)
      .not('topics.status', 'in', '("proposed","failed")')
      .order('created_at', { ascending: false })
      .limit(tradeLimit)

    if (category) q = q.eq('topics.category', category)

    const { data: rows } = await q
    for (const row of rows ?? []) {
      const profile = row.profiles as ActivityUser | null
      const topic = row.topics as {
        id: string; statement: string; category: string | null
        status: string; blue_pct: number | null; total_votes: number | null
      } | null
      if (!profile || !topic) continue
      events.push({
        id: `trade-${row.id as string}`,
        type: 'trade',
        ts: row.created_at as string,
        topic_id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        price: Math.round(topic.blue_pct ?? 50),
        side: row.side as 'blue' | 'red',
        user: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          role: profile.role ?? 'person',
          clout: profile.clout ?? 0,
        },
      })
    }
  }

  // ── Arguments ────────────────────────────────────────────────────────────────
  if (filter === 'all' || filter === 'argument') {
    const argLimit = filter === 'all' ? 20 : limit
    let q = supabase
      .from('arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        created_at,
        author:profiles!author_id (
          id,
          username,
          display_name,
          avatar_url,
          role,
          clout
        ),
        topics:topic_id (
          id,
          statement,
          category,
          status,
          blue_pct
        )
      `)
      .not('topics.status', 'in', '("proposed","failed")')
      .order('created_at', { ascending: false })
      .limit(argLimit)

    if (category) q = q.eq('topics.category', category)

    const { data: rows } = await q
    for (const row of rows ?? []) {
      const profile = row.author as ActivityUser | null
      const topic = row.topics as {
        id: string; statement: string; category: string | null
        status: string; blue_pct: number | null
      } | null
      if (!topic) continue
      events.push({
        id: `arg-${row.id as string}`,
        type: 'argument',
        ts: row.created_at as string,
        topic_id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        price: Math.round(topic.blue_pct ?? 50),
        side: row.side as 'blue' | 'red',
        content: (row.content as string | null)?.slice(0, 200) ?? undefined,
        upvotes: row.upvotes as number ?? 0,
        user: profile
          ? {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              role: profile.role ?? 'person',
              clout: profile.clout ?? 0,
            }
          : undefined,
      })
    }
  }

  // ── Threshold crossings ───────────────────────────────────────────────────────
  if (filter === 'all' || filter === 'crossing') {
    const crossLimit = filter === 'all' ? 15 : limit
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()

    const { data: snapshots } = await supabase
      .from('topic_price_history')
      .select(`
        id,
        topic_id,
        blue_pct,
        recorded_at,
        topics:topic_id (
          id,
          statement,
          category,
          status,
          blue_pct
        )
      `)
      .gte('recorded_at', since)
      .not('topics.status', 'in', '("proposed","failed")')
      .order('recorded_at', { ascending: false })
      .limit(500)

    if (snapshots && snapshots.length > 1) {
      const THRESHOLDS = [25, 50, 75] as const
      type ThresholdNum = 25 | 50 | 75
      const seen = new Set<string>()

      // Group by topic
      const byTopic = new Map<string, typeof snapshots>()
      for (const s of snapshots) {
        const tid = s.topic_id as string
        if (!byTopic.has(tid)) byTopic.set(tid, [])
        byTopic.get(tid)!.push(s)
      }

      for (const [tid, snaps] of byTopic.entries()) {
        // Sorted newest first already
        for (let i = 0; i < snaps.length - 1; i++) {
          const after = snaps[i]
          const before = snaps[i + 1]
          const pA = after.blue_pct as number
          const pB = before.blue_pct as number
          const topic = after.topics as {
            id: string; statement: string; category: string | null
            status: string; blue_pct: number | null
          } | null
          if (!topic) continue

          if (category && topic.category !== category) continue

          for (const threshold of THRESHOLDS) {
            const crossedUp = pB < threshold && pA >= threshold
            const crossedDown = pB >= threshold && pA < threshold
            if (!crossedUp && !crossedDown) continue

            const direction = crossedUp ? 'up' : 'down'
            const key = `${tid}-${threshold}-${direction}`
            if (seen.has(key)) continue
            seen.add(key)

            events.push({
              id: `cross-${tid}-${threshold}-${direction}`,
              type: 'crossing',
              ts: after.recorded_at as string,
              topic_id: tid,
              statement: topic.statement,
              category: topic.category,
              status: topic.status,
              price: Math.round(topic.blue_pct ?? pA),
              threshold: threshold as ThresholdNum,
              direction,
              crossing_label: crossingLabel(threshold, direction),
              price_before: Math.round(pB),
              price_after: Math.round(pA),
            })

            if (events.filter((e) => e.type === 'crossing').length >= crossLimit) break
          }
          if (events.filter((e) => e.type === 'crossing').length >= crossLimit) break
        }
        if (events.filter((e) => e.type === 'crossing').length >= crossLimit) break
      }
    }
  }

  // ── Law established events ────────────────────────────────────────────────────
  if (filter === 'all' || filter === 'law') {
    const lawLimit = filter === 'all' ? 5 : limit
    let q = supabase
      .from('topics')
      .select('id, statement, category, blue_pct, status, created_at')
      .eq('status', 'law')
      .order('created_at', { ascending: false })
      .limit(lawLimit)

    if (category) q = q.eq('category', category)

    const { data: laws } = await q
    for (const law of laws ?? []) {
      events.push({
        id: `law-${law.id as string}`,
        type: 'law',
        ts: law.created_at as string,
        topic_id: law.id as string,
        statement: law.statement as string,
        category: law.category as string | null,
        status: 'law',
        price: Math.round((law.blue_pct as number | null) ?? 100),
        crossing_label: 'Established as Law',
      })
    }
  }

  // Sort all events by timestamp desc and limit
  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  const sliced = events.slice(0, limit)

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const since1h = new Date(Date.now() - 3_600_000).toISOString()
  const [tradeCount, argCount] = await Promise.all([
    supabase.from('votes').select('topic_id', { count: 'exact', head: true }).gte('created_at', since1h),
    supabase.from('arguments').select('id', { count: 'exact', head: true }).gte('created_at', since1h),
  ])

  const recentTopics = sliced.map((e) => e.topic_id)
  const activeMkts = new Set(recentTopics).size

  const catCounts: Record<string, number> = {}
  for (const e of sliced) {
    if (e.category) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1
  }
  const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return NextResponse.json({
    events: sliced,
    stats: {
      events_1h: (tradeCount.count ?? 0) + (argCount.count ?? 0),
      trades_1h: tradeCount.count ?? 0,
      arguments_1h: argCount.count ?? 0,
      active_markets: activeMkts,
      top_category: topCategory,
    },
    filter,
    as_of: new Date().toISOString(),
  } satisfies ActivityResponse)
}
