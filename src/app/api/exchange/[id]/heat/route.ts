import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

/** One cell in the 7×24 activity grid (day-of-week × hour-of-day) */
export interface HeatCell {
  day: number   // 0 = Mon … 6 = Sun
  hour: number  // 0–23 UTC
  count: number // number of votes / snapshots in that bucket
}

/** A single "hot zone" — a contiguous price range with high activity */
export interface HotZone {
  price_min: number
  price_max: number
  label: string          // e.g. "55–65% For"
  count: number          // snapshots in zone
  pct_of_total: number   // 0–100
  side: 'for' | 'against' | 'contested'
}

/** An argument ordered by recent engagement velocity */
export interface HotArgument {
  id: string
  body: string
  side: 'for' | 'against'
  upvotes: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  heat_score: number     // 0–100 composite (recency × upvotes × recency-bonus)
  created_at: string
}

/** Daily vote volume over last 30 days */
export interface DailyVolume {
  date: string    // YYYY-MM-DD
  count: number
}

export interface HeatResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    volume: number
    created_at: string
  }
  heat_score: number            // 0–100 overall heat
  heat_label: string            // e.g. "Very Hot" | "Warm" | "Cool"
  peak_hour: number | null      // hour-of-day UTC with most activity (0–23)
  peak_day: number | null       // day-of-week with most activity (0=Mon)
  active_days: number           // days with any activity in last 30d
  grid: HeatCell[]              // 7×24 activity grid (may be sparse)
  hot_zones: HotZone[]          // top price zones by activity
  hot_arguments: HotArgument[]  // top 6 arguments by heat
  daily_volume: DailyVolume[]   // last 30 days vote volume
  snapshot_count: number
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function heatLabel(score: number): string {
  if (score >= 85) return 'Blazing'
  if (score >= 70) return 'Very Hot'
  if (score >= 55) return 'Hot'
  if (score >= 40) return 'Warm'
  if (score >= 25) return 'Lukewarm'
  return 'Cool'
}

function getHotZones(
  history: Array<{ price: number; recorded_at: string }>,
): HotZone[] {
  if (history.length === 0) return []

  // Bucket prices into 10-point bands: [0-10), [10-20), ...
  const BAND = 10
  const bands: Record<number, number> = {}
  for (const snap of history) {
    const band = Math.min(9, Math.floor(snap.price / BAND))
    bands[band] = (bands[band] ?? 0) + 1
  }

  const total = history.length
  const zones: HotZone[] = Object.entries(bands)
    .map(([b, count]) => {
      const band = Number(b)
      const min = band * BAND
      const max = min + BAND
      const midpoint = min + BAND / 2
      const side: HotZone['side'] =
        midpoint >= 60 ? 'for' : midpoint <= 40 ? 'against' : 'contested'
      return {
        price_min: min,
        price_max: max,
        label: `${min}–${max}% For`,
        count,
        pct_of_total: Math.round((count / total) * 100),
        side,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return zones
}

function computeHeatScore(
  snapshotCount: number,
  volume: number,
  activeDays: number,
  argCount: number,
): number {
  // Composite: volume component + frequency component + richness component
  const volumeScore   = Math.min(100, (volume / 200) * 100)
  const freqScore     = Math.min(100, (snapshotCount / 60) * 100)
  const activityScore = Math.min(100, (activeDays / 30) * 100)
  const richScore     = Math.min(100, (argCount / 10) * 100)

  return Math.round(
    volumeScore * 0.35 +
    freqScore   * 0.30 +
    activityScore * 0.20 +
    richScore   * 0.15,
  )
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', id)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // ── 2. Price history (last 90 snapshots) ─────────────────────────────────
  const { data: historyRaw } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: false })
    .limit(90)

  const history = (historyRaw ?? []).reverse()

  // ── 3. Arguments (for heat scoring) ──────────────────────────────────────
  const { data: argsRaw } = await supabase
    .from('arguments')
    .select('id, body, side, upvote_count, author_id, created_at, profiles:author_id(username, display_name, avatar_url)')
    .eq('topic_id', id)
    .order('upvote_count', { ascending: false })
    .limit(20)

  // ── 4. Build activity grid from price-history timestamps ─────────────────
  const gridMap = new Map<string, number>()
  let peakHourCount = -1
  let peakDayCount  = -1
  let peakHour: number | null = null
  let peakDay: number | null  = null

  const hourCounts = new Array<number>(24).fill(0)
  const dayCounts  = new Array<number>(7).fill(0)
  const dailyMap   = new Map<string, number>()

  for (const snap of history) {
    const d = new Date(snap.recorded_at)
    // getDay() returns 0=Sun…6=Sat; remap to 0=Mon…6=Sun
    const rawDay = d.getUTCDay()
    const day  = rawDay === 0 ? 6 : rawDay - 1
    const hour = d.getUTCHours()
    const key  = `${day}:${hour}`
    gridMap.set(key, (gridMap.get(key) ?? 0) + 1)
    hourCounts[hour]++
    dayCounts[day]++

    // Daily map
    const dateKey = d.toISOString().slice(0, 10)
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + 1)
  }

  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > peakHourCount) { peakHourCount = hourCounts[h]; peakHour = h }
  }
  for (let day = 0; day < 7; day++) {
    if (dayCounts[day] > peakDayCount) { peakDayCount = dayCounts[day]; peakDay = day }
  }

  const grid: HeatCell[] = []
  gridMap.forEach((count, key) => {
    const [dayStr, hourStr] = key.split(':')
    grid.push({ day: Number(dayStr), hour: Number(hourStr), count })
  })

  // Active days in last 30
  const activeDays = dailyMap.size

  // Daily volume for last 30 days
  const daily_volume: DailyVolume[] = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  // ── 5. Hot zones ──────────────────────────────────────────────────────────
  const hot_zones = getHotZones(history)

  // ── 6. Hot arguments ──────────────────────────────────────────────────────
  const now = Date.now()
  const hot_arguments: HotArgument[] = (argsRaw ?? [])
    .map((a) => {
      const ageMs   = now - new Date(a.created_at as string).getTime()
      const ageDays = ageMs / 86_400_000
      // Decay: recency bonus halves every 7 days
      const recencyMult = Math.max(0.1, Math.pow(0.5, ageDays / 7))
      const upvotes     = (a.upvote_count as number) ?? 0
      const heatScore   = Math.round(Math.min(100, ((upvotes + 1) * recencyMult) * 10))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prof: any = Array.isArray(a.profiles) ? (a.profiles[0] ?? {}) : (a.profiles ?? {})
      return {
        id: a.id as string,
        body: (a.body as string) ?? '',
        side: (a.side as 'for' | 'against') ?? 'for',
        upvotes,
        author_username: (prof.username as string) ?? 'anon',
        author_display_name: (prof.display_name as string | null) ?? null,
        author_avatar_url: (prof.avatar_url as string | null) ?? null,
        heat_score: heatScore,
        created_at: a.created_at as string,
      }
    })
    .sort((a, b) => b.heat_score - a.heat_score)
    .slice(0, 6)

  // ── 7. Composite heat score ────────────────────────────────────────────────
  const heat_score = computeHeatScore(
    history.length,
    topic.total_votes ?? 0,
    activeDays,
    (argsRaw ?? []).length,
  )

  const response: HeatResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      price: Math.round(topic.blue_pct ?? 50),
      volume: topic.total_votes ?? 0,
      created_at: topic.created_at,
    },
    heat_score,
    heat_label: heatLabel(heat_score),
    peak_hour: peakHour,
    peak_day: peakDay,
    active_days: activeDays,
    grid,
    hot_zones,
    hot_arguments,
    daily_volume,
    snapshot_count: history.length,
    as_of: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
