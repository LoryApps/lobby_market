import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarDay {
  date: string      // YYYY-MM-DD
  votes: number
  arguments: number
  laws: number
  total: number
  level: 0 | 1 | 2 | 3 | 4  // intensity 0=none … 4=max
}

export interface CalendarResponse {
  days: CalendarDay[]
  year: number
  totals: {
    votes: number
    arguments: number
    laws: number
    activeDays: number
    maxDay: number
    currentStreak: number
    longestStreak: number
  }
  mode: 'personal' | 'platform'
}

// ─── Thresholds for level colours ─────────────────────────────────────────────

function toLevel(n: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (n === 0) return 0
  if (max === 0) return 1
  const ratio = n / max
  if (ratio < 0.15) return 1
  if (ratio < 0.40) return 2
  if (ratio < 0.70) return 3
  return 4
}

// ─── Streak helpers ───────────────────────────────────────────────────────────

function calcStreaks(activeDates: Set<string>): { current: number; longest: number } {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let current = 0
  let longest = 0
  let streak = 0

  // Count backwards from today for current streak
  const cursor = new Date(today)
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    current++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  // Find longest streak across sorted dates
  const sorted = Array.from(activeDates).sort()
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      streak = 1
    } else {
      const prev = new Date(sorted[i - 1])
      const curr = new Date(sorted[i])
      const diff = (curr.getTime() - prev.getTime()) / 86_400_000
      streak = diff === 1 ? streak + 1 : 1
    }
    if (streak > longest) longest = streak
  }

  return { current, longest }
}

// ─── GET /api/stats/activity-calendar ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const year = parseInt(searchParams.get('year') ?? String(new Date().getUTCFullYear()), 10)
  const mode = searchParams.get('mode') === 'platform' ? 'platform' : 'personal'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const votesByDay: Record<string, number> = {}
  const argsByDay: Record<string, number> = {}
  const lawsByDay: Record<string, number> = {}

  // ── Votes ──────────────────────────────────────────────────────────────────

  if (mode === 'personal' && user) {
    const { data: votes } = await supabase
      .from('votes')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59Z')

    for (const v of votes ?? []) {
      const d = v.created_at.slice(0, 10)
      votesByDay[d] = (votesByDay[d] ?? 0) + 1
    }
  } else {
    // Platform-wide: aggregate vote counts per day
    const { data: votes } = await supabase
      .from('votes')
      .select('created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59Z')

    for (const v of votes ?? []) {
      const d = v.created_at.slice(0, 10)
      votesByDay[d] = (votesByDay[d] ?? 0) + 1
    }
  }

  // ── Arguments ─────────────────────────────────────────────────────────────

  if (mode === 'personal' && user) {
    const { data: args } = await supabase
      .from('topic_arguments')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59Z')

    for (const a of args ?? []) {
      const d = a.created_at.slice(0, 10)
      argsByDay[d] = (argsByDay[d] ?? 0) + 1
    }
  } else {
    const { data: args } = await supabase
      .from('topic_arguments')
      .select('created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59Z')

    for (const a of args ?? []) {
      const d = a.created_at.slice(0, 10)
      argsByDay[d] = (argsByDay[d] ?? 0) + 1
    }
  }

  // ── Laws established ──────────────────────────────────────────────────────

  {
    const { data: laws } = await supabase
      .from('topics')
      .select('established_at')
      .eq('status', 'law')
      .not('established_at', 'is', null)
      .gte('established_at', startDate)
      .lte('established_at', endDate + 'T23:59:59Z')

    for (const l of laws ?? []) {
      if (!l.established_at) continue
      const d = l.established_at.slice(0, 10)
      lawsByDay[d] = (lawsByDay[d] ?? 0) + 1
    }
  }

  // ── Build day grid (all 365/366 days of the year) ────────────────────────

  const days: CalendarDay[] = []
  const cursor = new Date(`${year}-01-01T00:00:00Z`)
  const endTs = new Date(`${year}-12-31T00:00:00Z`).getTime()

  const totalByDay: Record<string, number> = {}

  while (cursor.getTime() <= endTs) {
    const d = cursor.toISOString().slice(0, 10)
    const votes = votesByDay[d] ?? 0
    const args = argsByDay[d] ?? 0
    const laws = lawsByDay[d] ?? 0
    const total = votes + args + laws
    totalByDay[d] = total
    days.push({ date: d, votes, arguments: args, laws, total, level: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // Normalise levels relative to max activity
  const maxDay = Math.max(...Object.values(totalByDay), 0)
  for (const day of days) {
    day.level = toLevel(day.total, maxDay)
  }

  // ── Streak calc ───────────────────────────────────────────────────────────

  const activeDates = new Set<string>(Object.keys(totalByDay).filter((d) => totalByDay[d] > 0))
  const { current: currentStreak, longest: longestStreak } = calcStreaks(activeDates)

  // ── Totals ────────────────────────────────────────────────────────────────

  const totalVotes = Object.values(votesByDay).reduce((s, n) => s + n, 0)
  const totalArgs = Object.values(argsByDay).reduce((s, n) => s + n, 0)
  const totalLaws = Object.values(lawsByDay).reduce((s, n) => s + n, 0)

  return NextResponse.json({
    days,
    year,
    totals: {
      votes: totalVotes,
      arguments: totalArgs,
      laws: totalLaws,
      activeDays: activeDates.size,
      maxDay,
      currentStreak,
      longestStreak,
    },
    mode,
  } satisfies CalendarResponse)
}
