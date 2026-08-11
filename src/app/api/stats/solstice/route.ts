import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1-hour CDN cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SolsticeWeek {
  weekNum: number        // 0-51
  isoWeek: string        // YYYY-Www
  startDate: string      // YYYY-MM-DD (Monday)
  votes: number
  arguments: number
  laws: number
  total: number
  level: 0 | 1 | 2 | 3 | 4
  topCategory: string | null
}

export interface SolsticeSeason {
  name: 'Spring' | 'Summer' | 'Autumn' | 'Winter'
  label: string
  weeks: number[]
  totalActivity: number
  topCategory: string | null
  laws: number
}

export interface SolsticeResponse {
  weeks: SolsticeWeek[]
  year: number
  peakWeek: SolsticeWeek | null
  quietWeek: SolsticeWeek | null
  seasons: SolsticeSeason[]
  totals: {
    votes: number
    arguments: number
    laws: number
    activeWeeks: number
    maxWeek: number
  }
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLevel(n: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (n === 0) return 0
  if (max === 0) return 1
  const r = n / max
  if (r < 0.15) return 1
  if (r < 0.40) return 2
  if (r < 0.70) return 3
  return 4
}

/** ISO week number (1-based) for a UTC date */
function isoWeek(d: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { week, year: date.getUTCFullYear() }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const year = now.getUTCFullYear()

  // Look back exactly 52 weeks (364 days)
  const endDate = now.toISOString().slice(0, 10)
  const startTs = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000)
  const startDate = startTs.toISOString().slice(0, 10)

  // ── 1. Votes per day ──────────────────────────────────────────────────────

  const votesByDay: Record<string, number> = {}
  const { data: votes } = await supabase
    .from('votes')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59Z')

  for (const v of votes ?? []) {
    const d = (v.created_at as string).slice(0, 10)
    votesByDay[d] = (votesByDay[d] ?? 0) + 1
  }

  // ── 2. Arguments per day ──────────────────────────────────────────────────

  const argsByDay: Record<string, number> = {}
  const { data: args } = await supabase
    .from('topic_arguments')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59Z')

  for (const a of args ?? []) {
    const d = (a.created_at as string).slice(0, 10)
    argsByDay[d] = (argsByDay[d] ?? 0) + 1
  }

  // ── 3. Laws established per day (from the laws table) ────────────────────

  const lawsByDay: Record<string, number> = {}
  const lawCatsByDay: Record<string, Record<string, number>> = {}
  const { data: laws } = await supabase
    .from('laws')
    .select('established_at, category')
    .gte('established_at', startDate)
    .lte('established_at', endDate + 'T23:59:59Z')

  for (const l of laws ?? []) {
    const d = (l.established_at as string).slice(0, 10)
    lawsByDay[d] = (lawsByDay[d] ?? 0) + 1
    if (l.category) {
      lawCatsByDay[d] = lawCatsByDay[d] ?? {}
      lawCatsByDay[d][l.category] = (lawCatsByDay[d][l.category] ?? 0) + 1
    }
  }

  // ── 4. Bucket into 52 weeks (anchored to startTs) ────────────────────────

  const weekBuckets: Array<{
    votes: number
    arguments: number
    laws: number
    catCounts: Record<string, number>
    startDate: string
  }> = Array.from({ length: 52 }, (_, i) => {
    const monday = new Date(startTs.getTime() + i * 7 * 24 * 60 * 60 * 1000)
    const dow = monday.getUTCDay() || 7
    monday.setUTCDate(monday.getUTCDate() - (dow - 1))
    return { votes: 0, arguments: 0, laws: 0, catCounts: {}, startDate: monday.toISOString().slice(0, 10) }
  })

  const startMs = startTs.getTime()

  function dayToWeekIdx(dateStr: string): number {
    const dayMs = new Date(dateStr + 'T00:00:00Z').getTime()
    return Math.min(51, Math.max(0, Math.floor((dayMs - startMs) / (7 * 24 * 60 * 60 * 1000))))
  }

  for (const [d, count] of Object.entries(votesByDay)) {
    weekBuckets[dayToWeekIdx(d)].votes += count
  }
  for (const [d, count] of Object.entries(argsByDay)) {
    weekBuckets[dayToWeekIdx(d)].arguments += count
  }
  for (const [d, count] of Object.entries(lawsByDay)) {
    const idx = dayToWeekIdx(d)
    weekBuckets[idx].laws += count
    for (const [cat, cnt] of Object.entries(lawCatsByDay[d] ?? {})) {
      weekBuckets[idx].catCounts[cat] = (weekBuckets[idx].catCounts[cat] ?? 0) + cnt
    }
  }

  // ── 5. Build SolsticeWeek array ───────────────────────────────────────────

  const maxTotal = Math.max(...weekBuckets.map(b => b.votes + b.arguments + b.laws), 0)

  const weeks: SolsticeWeek[] = weekBuckets.map((b, i) => {
    const total = b.votes + b.arguments + b.laws
    const topCat = Object.entries(b.catCounts).sort((a, z) => z[1] - a[1])[0]?.[0] ?? null
    const monday = new Date(b.startDate + 'T00:00:00Z')
    const iw = isoWeek(monday)
    return {
      weekNum: i,
      isoWeek: `${iw.year}-W${String(iw.week).padStart(2, '0')}`,
      startDate: b.startDate,
      votes: b.votes,
      arguments: b.arguments,
      laws: b.laws,
      total,
      level: toLevel(total, maxTotal),
      topCategory: topCat,
    }
  })

  // ── 6. Peak / quiet weeks ─────────────────────────────────────────────────

  const activeWeeks = weeks.filter(w => w.total > 0)
  const peakWeek = activeWeeks.length
    ? [...activeWeeks].sort((a, b) => b.total - a.total)[0]
    : null
  const quietWeek = activeWeeks.length > 1
    ? [...activeWeeks].sort((a, b) => a.total - b.total)[0]
    : null

  // ── 7. Seasons ────────────────────────────────────────────────────────────

  const SEASONS: Array<{ name: SolsticeSeason['name']; label: string; months: number[] }> = [
    { name: 'Winter', label: 'Dec–Feb', months: [12, 1, 2] },
    { name: 'Spring', label: 'Mar–May', months: [3, 4, 5] },
    { name: 'Summer', label: 'Jun–Aug', months: [6, 7, 8] },
    { name: 'Autumn', label: 'Sep–Nov', months: [9, 10, 11] },
  ]

  const seasons: SolsticeSeason[] = SEASONS.map(s => {
    const sw = weeks.filter(w => {
      const m = new Date(w.startDate + 'T00:00:00Z').getUTCMonth() + 1
      return s.months.includes(m)
    })
    const totalActivity = sw.reduce((sum, w) => sum + w.total, 0)
    const catAgg: Record<string, number> = {}
    for (const w of sw) {
      if (w.topCategory) catAgg[w.topCategory] = (catAgg[w.topCategory] ?? 0) + w.total
    }
    const topCat = Object.entries(catAgg).sort((a, z) => z[1] - a[1])[0]?.[0] ?? null
    const lawsCount = sw.reduce((sum, w) => sum + w.laws, 0)
    return {
      name: s.name,
      label: `${s.name} · ${s.label}`,
      weeks: sw.map(w => w.weekNum),
      totalActivity,
      topCategory: topCat,
      laws: lawsCount,
    }
  })

  // ── 8. Totals ─────────────────────────────────────────────────────────────

  return NextResponse.json({
    weeks,
    year,
    peakWeek,
    quietWeek,
    seasons,
    totals: {
      votes: weeks.reduce((s, w) => s + w.votes, 0),
      arguments: weeks.reduce((s, w) => s + w.arguments, 0),
      laws: weeks.reduce((s, w) => s + w.laws, 0),
      activeWeeks: activeWeeks.length,
      maxWeek: maxTotal,
    },
    generatedAt: now.toISOString(),
  } satisfies SolsticeResponse)
}
