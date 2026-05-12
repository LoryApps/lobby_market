import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayOfWeekStat {
  day: string        // "Mon", "Tue", etc.
  dayIndex: number   // 0 = Sun
  voteCount: number
  forCount: number
  againstCount: number
}

export interface HourOfDayStat {
  hour: number       // 0–23 UTC
  voteCount: number
}

export interface WeeklyStat {
  weekKey: string    // "2025-W01"
  weekLabel: string  // "Jan 1"
  voteCount: number
  forCount: number
  againstCount: number
}

export interface StreakEvent {
  start: string      // ISO date
  end: string        // ISO date
  length: number
  type: 'active' | 'best'
}

export interface VoteMilestone {
  milestone: number
  label: string
  achievedAt: string | null
}

export interface VotesAnalyticsResponse {
  totalVotes: number
  forCount: number
  againstCount: number
  forPct: number
  currentStreak: number
  longestStreak: number
  firstVoteAt: string | null
  lastVoteAt: string | null
  daysActive: number
  avgVotesPerActiveDay: number
  majorityVotes: number
  contrarianVotes: number
  contrarianPct: number
  dayOfWeekStats: DayOfWeekStat[]
  hourOfDayStats: HourOfDayStat[]
  weeklyStats: WeeklyStat[]
  milestones: VoteMilestone[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // ISO week: Thursday in current week = determine week
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function weekLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all user votes (up to 5000 most recent)
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('id, side, created_at, topic_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(5000)

  const votes = votesRaw ?? []

  if (votes.length === 0) {
    return NextResponse.json({
      totalVotes: 0,
      forCount: 0,
      againstCount: 0,
      forPct: 0,
      currentStreak: 0,
      longestStreak: 0,
      firstVoteAt: null,
      lastVoteAt: null,
      daysActive: 0,
      avgVotesPerActiveDay: 0,
      majorityVotes: 0,
      contrarianVotes: 0,
      contrarianPct: 0,
      dayOfWeekStats: DAY_NAMES.map((day, i) => ({ day, dayIndex: i, voteCount: 0, forCount: 0, againstCount: 0 })),
      hourOfDayStats: Array.from({ length: 24 }, (_, h) => ({ hour: h, voteCount: 0 })),
      weeklyStats: [],
      milestones: MILESTONES.map((m) => ({ milestone: m, label: `${m} Vote${m === 1 ? '' : 's'}`, achievedAt: null })),
    } satisfies VotesAnalyticsResponse)
  }

  const forCount = votes.filter((v) => v.side === 'blue').length
  const againstCount = votes.length - forCount
  const forPct = votes.length > 0 ? Math.round((forCount / votes.length) * 100) : 0

  // ── Streak calculation ─────────────────────────────────────────────────────
  // Build a sorted set of unique calendar days (UTC) with votes
  const activeDaysSet = new Set<string>()
  for (const v of votes) {
    activeDaysSet.add(v.created_at.slice(0, 10))
  }
  const activeDays = Array.from(activeDaysSet).sort()
  const daysActive = activeDays.length

  let longestStreak = 0
  let currentStreak = 0
  let streak = 1

  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  for (let i = 1; i < activeDays.length; i++) {
    const prev = new Date(activeDays[i - 1])
    const curr = new Date(activeDays[i])
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    if (diffDays === 1) {
      streak++
    } else {
      streak = 1
    }
    if (streak > longestStreak) longestStreak = streak
  }
  if (activeDays.length === 1) longestStreak = 1

  // Current streak: must include today or yesterday
  const lastDay = activeDays[activeDays.length - 1]
  if (lastDay === todayStr || lastDay === yesterdayStr) {
    let s = 1
    for (let i = activeDays.length - 2; i >= 0; i--) {
      const curr = new Date(activeDays[i + 1])
      const prev = new Date(activeDays[i])
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000)
      if (diff === 1) s++
      else break
    }
    currentStreak = s
  }

  // ── Day of week breakdown ─────────────────────────────────────────────────
  const dowMap = new Array(7).fill(null).map((_, i) => ({
    day: DAY_NAMES[i],
    dayIndex: i,
    voteCount: 0,
    forCount: 0,
    againstCount: 0,
  }))
  for (const v of votes) {
    const d = new Date(v.created_at)
    const dow = d.getUTCDay()
    dowMap[dow].voteCount++
    if (v.side === 'blue') dowMap[dow].forCount++
    else dowMap[dow].againstCount++
  }

  // ── Hour of day breakdown ─────────────────────────────────────────────────
  const hourMap: HourOfDayStat[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, voteCount: 0 }))
  for (const v of votes) {
    const h = new Date(v.created_at).getUTCHours()
    hourMap[h].voteCount++
  }

  // ── Weekly stats (last 26 weeks) ─────────────────────────────────────────
  const twentySixWeeksAgo = new Date(Date.now() - 26 * 7 * 24 * 60 * 60 * 1000)
  const recentVotes = votes.filter((v) => new Date(v.created_at) >= twentySixWeeksAgo)

  const weekMap = new Map<string, WeeklyStat>()
  for (const v of recentVotes) {
    const d = new Date(v.created_at)
    const key = toWeekKey(d)
    if (!weekMap.has(key)) {
      weekMap.set(key, {
        weekKey: key,
        weekLabel: weekLabel(v.created_at),
        voteCount: 0,
        forCount: 0,
        againstCount: 0,
      })
    }
    const w = weekMap.get(key)!
    w.voteCount++
    if (v.side === 'blue') w.forCount++
    else w.againstCount++
  }
  const weeklyStats = Array.from(weekMap.values()).sort((a, b) => a.weekKey.localeCompare(b.weekKey))

  // ── Majority vs contrarian ────────────────────────────────────────────────
  // Fetch topic blue_pct for topic_ids that have votes
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))
  let topicPctMap = new Map<string, number>()

  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, blue_pct')
      .in('id', topicIds)
    if (topicRows) {
      topicPctMap = new Map(topicRows.map((t) => [t.id, t.blue_pct ?? 50]))
    }
  }

  let majorityVotes = 0
  let contrarianVotes = 0
  for (const v of votes) {
    const bluePct = topicPctMap.get(v.topic_id) ?? 50
    const majorityIsSide = bluePct >= 50 ? 'blue' : 'red'
    if (v.side === majorityIsSide) majorityVotes++
    else contrarianVotes++
  }
  const contrarianPct = votes.length > 0 ? Math.round((contrarianVotes / votes.length) * 100) : 0

  // ── Milestones ────────────────────────────────────────────────────────────
  const milestones: VoteMilestone[] = MILESTONES.map((m) => ({
    milestone: m,
    label: `${m.toLocaleString()} Vote${m === 1 ? '' : 's'}`,
    achievedAt: votes.length >= m ? (votes[m - 1]?.created_at ?? null) : null,
  }))

  const avgVotesPerActiveDay = daysActive > 0 ? Math.round((votes.length / daysActive) * 10) / 10 : 0

  return NextResponse.json({
    totalVotes: votes.length,
    forCount,
    againstCount,
    forPct,
    currentStreak,
    longestStreak,
    firstVoteAt: votes[0]?.created_at ?? null,
    lastVoteAt: votes[votes.length - 1]?.created_at ?? null,
    daysActive,
    avgVotesPerActiveDay,
    majorityVotes,
    contrarianVotes,
    contrarianPct,
    dayOfWeekStats: dowMap,
    hourOfDayStats: hourMap,
    weeklyStats,
    milestones,
  } satisfies VotesAnalyticsResponse)
}
