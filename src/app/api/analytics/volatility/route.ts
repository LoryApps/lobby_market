import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeatmapDay {
  date: string   // YYYY-MM-DD
  count: number
}

export interface MonthPoint {
  month: string  // e.g. "Aug 2026"
  count: number
}

export type RhythmType =
  | 'burst_voter'
  | 'steady_citizen'
  | 'weekend_warrior'
  | 'daily_habit'
  | 'dormant'

export interface VolatilityData {
  stability_score: number       // 0–100 (100 = perfectly consistent)
  volatility_score: number      // 0–100 (100 = wildly erratic)
  rhythm_type: RhythmType
  rhythm_label: string
  rhythm_desc: string

  total_votes: number
  days_active: number           // days with at least 1 vote
  avg_per_active_day: number    // average votes on days when they voted
  peak_day_votes: number        // most votes cast in a single day
  longest_gap_days: number      // longest consecutive days without a vote

  current_streak: number        // consecutive days with a vote (ending today)
  longest_streak: number        // best consecutive-day streak ever

  // 7 slots, 0 = Sunday
  dow_distribution: number[]
  preferred_day: string         // "Monday", "Sunday", etc.

  // 24 slots, 0 = midnight UTC
  hour_distribution: number[]
  peak_hour: number             // 0–23

  // last 90 days, oldest first
  heatmap: HeatmapDay[]

  // last 6 months, oldest first
  monthly: MonthPoint[]

  // raw coefficient of variation (stddev / mean over daily counts)
  cv: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

// YYYY-MM-DD string from a Date in UTC
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  // Fetch all votes for this user (up to 2000 rows, last ~3 years is plenty)
  const { data: rows } = await supabase
    .from('votes')
    .select('created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: true })
    .limit(2000)

  const votes = (rows ?? []) as { created_at: string }[]
  const total_votes = votes.length

  // ── Empty / dormant ────────────────────────────────────────────────────────

  if (total_votes === 0) {
    const empty: VolatilityData = {
      stability_score: 0,
      volatility_score: 0,
      rhythm_type: 'dormant',
      rhythm_label: 'Not Yet Active',
      rhythm_desc: 'Cast your first vote to see your engagement rhythm.',
      total_votes: 0,
      days_active: 0,
      avg_per_active_day: 0,
      peak_day_votes: 0,
      longest_gap_days: 0,
      current_streak: 0,
      longest_streak: 0,
      dow_distribution: Array(7).fill(0),
      preferred_day: '—',
      hour_distribution: Array(24).fill(0),
      peak_hour: 0,
      heatmap: [],
      monthly: [],
      cv: 0,
    }
    return NextResponse.json(empty)
  }

  // ── Build per-date map ─────────────────────────────────────────────────────

  const perDay = new Map<string, number>()
  const dow_distribution = Array(7).fill(0)
  const hour_distribution = Array(24).fill(0)

  for (const v of votes) {
    const d = new Date(v.created_at)
    const dateStr = toDateStr(d)
    perDay.set(dateStr, (perDay.get(dateStr) ?? 0) + 1)
    dow_distribution[d.getUTCDay()] += 1
    hour_distribution[d.getUTCHours()] += 1
  }

  const dailyCounts = Array.from(perDay.values())
  const days_active = dailyCounts.length
  const peak_day_votes = Math.max(...dailyCounts)
  const avg_per_active_day = Math.round((total_votes / days_active) * 10) / 10

  // ── Stability / Volatility ─────────────────────────────────────────────────

  // CV only over active days
  const cv = days_active >= 2 ? stddev(dailyCounts) / mean(dailyCounts) : 0

  // Stability: 100 = perfectly even, 0 = extremely bursty
  // CV of 0 → stability 100; CV of 2+ → stability ~0
  const stability_score = Math.round(Math.max(0, Math.min(100, 100 - cv * 45)))
  const volatility_score = 100 - stability_score

  // ── Streaks & gaps ─────────────────────────────────────────────────────────

  const allDates = Array.from(perDay.keys()).sort()
  let longest_streak = 1
  let current_run = 1
  let longest_gap_days = 0
  let current_gap = 0

  const today = toDateStr(new Date())

  for (let i = 1; i < allDates.length; i++) {
    const prev = new Date(allDates[i - 1])
    const curr = new Date(allDates[i])
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    if (diff === 1) {
      current_run++
      current_gap = 0
      if (current_run > longest_streak) longest_streak = current_run
    } else {
      current_run = 1
      current_gap = diff - 1
      if (current_gap > longest_gap_days) longest_gap_days = current_gap
    }
  }

  // Current streak: walk back from today
  let current_streak = 0
  let checkDate = new Date(today)
  while (true) {
    const ds = toDateStr(checkDate)
    if (perDay.has(ds)) {
      current_streak++
      checkDate = addDays(checkDate, -1)
    } else {
      break
    }
  }

  // ── Preferred day ─────────────────────────────────────────────────────────

  const preferred_dow = dow_distribution.indexOf(Math.max(...dow_distribution))
  const preferred_day = DOW_NAMES[preferred_dow]

  const peak_hour = hour_distribution.indexOf(Math.max(...hour_distribution))

  // ── Weekend warrior? ──────────────────────────────────────────────────────

  const weekend_votes = dow_distribution[0] + dow_distribution[6]
  const weekday_votes = total_votes - weekend_votes
  const weekend_pct = total_votes > 0 ? weekend_votes / total_votes : 0

  // ── Rhythm type ───────────────────────────────────────────────────────────

  let rhythm_type: RhythmType
  let rhythm_label: string
  let rhythm_desc: string

  if (days_active < 3) {
    rhythm_type = 'dormant'
    rhythm_label = 'Getting Started'
    rhythm_desc = 'Vote more to reveal your civic engagement pattern.'
  } else if (weekend_pct > 0.55 && weekday_votes < weekend_votes) {
    rhythm_type = 'weekend_warrior'
    rhythm_label = 'Weekend Warrior'
    rhythm_desc =
      'You come alive on weekends. While others go quiet, you\'re at your civic peak on Saturdays and Sundays.'
  } else if (stability_score >= 75) {
    if (days_active >= Math.min(total_votes, 30)) {
      rhythm_type = 'daily_habit'
      rhythm_label = 'Daily Habit'
      rhythm_desc =
        'Voting is baked into your routine. You show up consistently, day after day — the backbone of healthy civic discourse.'
    } else {
      rhythm_type = 'steady_citizen'
      rhythm_label = 'Steady Citizen'
      rhythm_desc =
        'Reliable and predictable — your engagement is spread evenly without dramatic spikes or absences.'
    }
  } else {
    rhythm_type = 'burst_voter'
    rhythm_label = 'Burst Voter'
    rhythm_desc =
      'You vote in concentrated bursts of activity followed by quieter periods. When you engage, you go all in.'
  }

  // ── 90-day heatmap ────────────────────────────────────────────────────────

  const heatmap: HeatmapDay[] = []
  const ninetyDaysAgo = addDays(new Date(today), -89)
  let cursor = new Date(ninetyDaysAgo)
  for (let i = 0; i < 90; i++) {
    const ds = toDateStr(cursor)
    heatmap.push({ date: ds, count: perDay.get(ds) ?? 0 })
    cursor = addDays(cursor, 1)
  }

  // ── Monthly trend (last 6 months) ─────────────────────────────────────────

  const monthly: MonthPoint[] = []
  const now = new Date(today)
  for (let m = 5; m >= 0; m--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1))
    const year = d.getUTCFullYear()
    const mo = d.getUTCMonth()
    const prefix = `${year}-${String(mo + 1).padStart(2, '0')}`
    let count = 0
    for (const [k, v] of perDay.entries()) {
      if (k.startsWith(prefix)) count += v
    }
    monthly.push({
      month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      count,
    })
  }

  const result: VolatilityData = {
    stability_score,
    volatility_score,
    rhythm_type,
    rhythm_label,
    rhythm_desc,
    total_votes,
    days_active,
    avg_per_active_day,
    peak_day_votes,
    longest_gap_days,
    current_streak,
    longest_streak,
    dow_distribution,
    preferred_day,
    hour_distribution,
    peak_hour,
    heatmap,
    monthly,
    cv: Math.round(cv * 100) / 100,
  }

  return NextResponse.json(result)
}
