import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreakRun {
  start: string    // ISO date YYYY-MM-DD
  end: string      // ISO date YYYY-MM-DD
  length: number
}

export interface DayOfWeekStat {
  day: number          // 0=Sun … 6=Sat
  label: string
  short: string
  vote_days: number    // how many Mondays (etc.) had at least one vote
  streak_starts: number
  streak_breaks: number
}

export interface HeatmapDay {
  date: string   // YYYY-MM-DD
  count: number  // votes cast that day
}

export interface StreakAnalyticsData {
  current_streak: number
  longest_streak: number
  total_active_days: number
  total_votes: number
  heatmap: HeatmapDay[]          // 13 full weeks (Mon–Sun)
  all_streaks: StreakRun[]       // every streak ≥1, sorted descending by length
  day_of_week: DayOfWeekStat[]
  avg_streak_length: number      // mean across all runs
  median_streak_length: number
  significant_breaks: number     // streak ≥7 days that then broke
  current_tier: string           // matches streakTier labels
  tier_color: string
  next_milestone: number | null  // days to reach next tier (null if Legendary)
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

// ─── Tier helpers (must match streakTier in lib/utils/streak-tier.ts) ─────────

const TIERS = [
  { min: 100, label: 'Legendary',    color: 'text-gold' },
  { min: 60,  label: 'Transcendent', color: 'text-purple' },
  { min: 30,  label: 'Diamond',      color: 'text-for-300' },
  { min: 14,  label: 'Blazing',      color: 'text-emerald' },
  { min: 7,   label: 'Hot',          color: 'text-against-300' },
  { min: 3,   label: 'Active',       color: 'text-surface-400' },
  { min: 1,   label: 'Starting',     color: 'text-surface-500' },
]

function resolveTier(days: number): { label: string; color: string; next: number | null } {
  for (const t of TIERS) {
    if (days >= t.min) {
      const idx = TIERS.indexOf(t)
      const prev = idx > 0 ? TIERS[idx - 1] : null
      return { label: t.label, color: t.color, next: prev ? prev.min : null }
    }
  }
  return { label: 'None', color: 'text-surface-600', next: 1 }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toLocalDate(iso: string): string {
  // Treat timestamps as UTC, return YYYY-MM-DD
  return iso.slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T00:00:00Z').getTime()
  const msB = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((msB - msA) / 86_400_000)
}

function getUTCDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay()
}

// Monday-based week start containing `dateStr`
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=Sun
  const offset = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const DAY_CONFIG = [
  { label: 'Sunday',    short: 'Sun' },
  { label: 'Monday',    short: 'Mon' },
  { label: 'Tuesday',   short: 'Tue' },
  { label: 'Wednesday', short: 'Wed' },
  { label: 'Thursday',  short: 'Thu' },
  { label: 'Friday',    short: 'Fri' },
  { label: 'Saturday',  short: 'Sat' },
]

// ─── GET /api/analytics/streak ────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  const [profileRes, votesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url, vote_streak')
      .eq('id', uid)
      .maybeSingle(),

    supabase
      .from('votes')
      .select('created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: true }),
  ])

  const profile = profileRes.data
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const votes = votesRes.data ?? []

  // ── Build a map: date → vote count ────────────────────────────────────────
  const votesByDay = new Map<string, number>()
  for (const v of votes) {
    const d = toLocalDate(v.created_at)
    votesByDay.set(d, (votesByDay.get(d) ?? 0) + 1)
  }

  const sortedDays = [...votesByDay.keys()].sort()
  const totalActiveDays = sortedDays.length
  const totalVotes = votes.length

  // ── Build all streak runs ──────────────────────────────────────────────────
  const allStreaks: StreakRun[] = []
  if (sortedDays.length > 0) {
    let runStart = sortedDays[0]
    let runEnd = sortedDays[0]

    for (let i = 1; i < sortedDays.length; i++) {
      const prev = sortedDays[i - 1]
      const curr = sortedDays[i]
      if (daysBetween(prev, curr) === 1) {
        runEnd = curr
      } else {
        allStreaks.push({ start: runStart, end: runEnd, length: daysBetween(runStart, runEnd) + 1 })
        runStart = curr
        runEnd = curr
      }
    }
    allStreaks.push({ start: runStart, end: runEnd, length: daysBetween(runStart, runEnd) + 1 })
  }

  allStreaks.sort((a, b) => b.length - a.length)

  const longestStreak = allStreaks[0]?.length ?? 0
  const currentStreak = profile.vote_streak ?? 0

  // ── Streak stats ──────────────────────────────────────────────────────────
  const avgStreakLength =
    allStreaks.length > 0
      ? Math.round((allStreaks.reduce((s, r) => s + r.length, 0) / allStreaks.length) * 10) / 10
      : 0

  const sortedByLen = [...allStreaks].sort((a, b) => a.length - b.length)
  const mid = Math.floor(sortedByLen.length / 2)
  const medianStreakLength =
    sortedByLen.length === 0
      ? 0
      : sortedByLen.length % 2 === 1
        ? sortedByLen[mid].length
        : Math.round(((sortedByLen[mid - 1].length + sortedByLen[mid].length) / 2) * 10) / 10

  // Significant breaks: streak ≥7 that was then followed by a gap (or still current)
  const significantBreaks = allStreaks.filter(
    (r, i) => r.length >= 7 && i !== 0 && r !== allStreaks.find(s => s.end === sortedDays[sortedDays.length - 1])
  ).length

  // ── Heatmap: 13 full weeks ending this week ────────────────────────────────
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const thisWeekStart = weekStart(todayStr)
  const heatmapStart = addDays(thisWeekStart, -12 * 7) // 13 weeks back

  const heatmap: HeatmapDay[] = []
  let cursor = heatmapStart
  while (cursor <= todayStr) {
    heatmap.push({ date: cursor, count: votesByDay.get(cursor) ?? 0 })
    cursor = addDays(cursor, 1)
  }

  // ── Day of week breakdown ──────────────────────────────────────────────────
  const dowStats: DayOfWeekStat[] = DAY_CONFIG.map((cfg, day) => ({
    day,
    label: cfg.label,
    short: cfg.short,
    vote_days: 0,
    streak_starts: 0,
    streak_breaks: 0,
  }))

  for (const d of sortedDays) {
    dowStats[getUTCDayOfWeek(d)].vote_days += 1
  }

  for (const run of allStreaks) {
    const startDay = getUTCDayOfWeek(run.start)
    const endDay = getUTCDayOfWeek(run.end)
    dowStats[startDay].streak_starts += 1
    if (run.end !== sortedDays[sortedDays.length - 1]) {
      dowStats[endDay].streak_breaks += 1
    }
  }

  // ── Tier ──────────────────────────────────────────────────────────────────
  const tier = resolveTier(currentStreak)

  const data: StreakAnalyticsData = {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    total_active_days: totalActiveDays,
    total_votes: totalVotes,
    heatmap,
    all_streaks: allStreaks.slice(0, 20),  // top 20
    day_of_week: dowStats,
    avg_streak_length: avgStreakLength,
    median_streak_length: medianStreakLength,
    significant_breaks: significantBreaks,
    current_tier: tier.label,
    tier_color: tier.color,
    next_milestone: tier.next !== null ? tier.next - currentStreak : null,
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
  }

  return NextResponse.json(data)
}
