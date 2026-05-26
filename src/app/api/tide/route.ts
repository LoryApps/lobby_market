import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TideDaypoint {
  date: string        // YYYY-MM-DD
  laws: number        // laws established on this day
  topics_created: number
  avg_blue_pct: number  // avg FOR% of laws established on this day (null if 0 laws)
}

export interface TideCategoryRow {
  category: string
  active_topics: number
  law_count_30d: number    // laws in last 30 days
  law_count_prev: number   // laws in previous 30 days (for trend)
  avg_blue_pct: number     // current FOR% across active/voting topics
  contested_count: number  // topics within 10% of 50/50
  trend: 'rising' | 'falling' | 'stable'
}

export interface TidePlatformStats {
  total_active: number
  total_laws_30d: number
  total_laws_prev_30d: number
  avg_blue_pct_current: number    // avg FOR% of all active/voting topics right now
  avg_blue_pct_30d_laws: number  // avg FOR% of laws established in last 30 days
  contested_topics: number        // topics within 5% of 50/50
  strong_mandate_topics: number   // topics >75% FOR or <25% FOR
  tide_direction: 'rising' | 'falling' | 'stable'
  temperature: number             // 0–100: 50 = deeply contested, 100 = full consensus
}

export interface TideResponse {
  days: TideDaypoint[]
  categories: TideCategoryRow[]
  platform: TidePlatformStats
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

function buildDayGrid(start: Date, end: Date): TideDaypoint[] {
  const days: TideDaypoint[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    days.push({
      date: cursor.toISOString().slice(0, 10),
      laws: 0,
      topics_created: 0,
      avg_blue_pct: 50,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const day30Ago = new Date(now)
  day30Ago.setUTCDate(day30Ago.getUTCDate() - 30)
  const day60Ago = new Date(now)
  day60Ago.setUTCDate(day60Ago.getUTCDate() - 60)

  const [lawsRes, topicsCreatedRes, activeTopicsRes, categoryLawsRes] = await Promise.all([
    // Laws established in last 60 days (30d + prior 30d for trend)
    supabase
      .from('laws')
      .select('established_at, category, blue_pct, total_votes')
      .gte('established_at', day60Ago.toISOString())
      .order('established_at', { ascending: true }),

    // Topics created in last 30 days
    supabase
      .from('topics')
      .select('created_at, category, blue_pct, status')
      .gte('created_at', day30Ago.toISOString())
      .order('created_at', { ascending: true }),

    // Current active/voting topics for live sentiment
    supabase
      .from('topics')
      .select('category, blue_pct, total_votes, status')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 1),

    // All-time law counts by category for comparison
    supabase
      .from('laws')
      .select('category, established_at, blue_pct')
      .gte('established_at', day60Ago.toISOString()),
  ])

  // ── Build 30-day grid ───────────────────────────────────────────────────────
  const days = buildDayGrid(day30Ago, now)
  const dayMap = new Map(days.map((d) => [d.date, d]))

  // Law sums per day (last 30d only for chart)
  const lawsByDay = new Map<string, { count: number; blueSum: number }>()
  for (const law of (lawsRes.data ?? [])) {
    const dk = dateKey(law.established_at)
    if (!lawsByDay.has(dk)) lawsByDay.set(dk, { count: 0, blueSum: 0 })
    const entry = lawsByDay.get(dk)!
    entry.count++
    entry.blueSum += law.blue_pct ?? 50
  }
  for (const [date, { count, blueSum }] of lawsByDay) {
    const d = dayMap.get(date)
    if (d) {
      d.laws = count
      d.avg_blue_pct = count > 0 ? Math.round(blueSum / count) : 50
    }
  }

  // Topics created per day
  for (const t of (topicsCreatedRes.data ?? [])) {
    const dk = dateKey(t.created_at)
    const d = dayMap.get(dk)
    if (d) d.topics_created++
  }

  // ── Platform stats ─────────────────────────────────────────────────────────
  const activeTopics = activeTopicsRes.data ?? []
  const total_active = activeTopics.length
  const avg_blue_pct_current = total_active > 0
    ? Math.round(activeTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / total_active)
    : 50
  const contested_topics = activeTopics.filter((t) => Math.abs((t.blue_pct ?? 50) - 50) <= 5).length
  const strong_mandate_topics = activeTopics.filter(
    (t) => (t.blue_pct ?? 50) >= 75 || (t.blue_pct ?? 50) <= 25
  ).length

  const allLaws = categoryLawsRes.data ?? []
  const laws30d = allLaws.filter((l) => new Date(l.established_at) >= day30Ago)
  const lawsPrev = allLaws.filter((l) => new Date(l.established_at) < day30Ago)
  const total_laws_30d = laws30d.length
  const total_laws_prev_30d = lawsPrev.length
  const avg_blue_pct_30d_laws = laws30d.length > 0
    ? Math.round(laws30d.reduce((s, l) => s + (l.blue_pct ?? 50), 0) / laws30d.length)
    : 50

  // Tide direction: more laws this month vs last? AND higher FOR% among live topics?
  const lawTrend = total_laws_30d - total_laws_prev_30d
  const tide_direction: TidePlatformStats['tide_direction'] =
    lawTrend > 2 ? 'rising' : lawTrend < -2 ? 'falling' : 'stable'

  // Temperature: how far from 50/50 (averaged across all active topics)
  // 50 = all deadlocked; 100 = all at 100% or 0% (pure consensus)
  const temperature = total_active > 0
    ? Math.round(
        50 + activeTopics.reduce((s, t) => s + Math.abs((t.blue_pct ?? 50) - 50), 0) / total_active
      )
    : 50

  const platform: TidePlatformStats = {
    total_active,
    total_laws_30d,
    total_laws_prev_30d,
    avg_blue_pct_current,
    avg_blue_pct_30d_laws,
    contested_topics,
    strong_mandate_topics,
    tide_direction,
    temperature: Math.min(100, temperature),
  }

  // ── Category breakdown ────────────────────────────────────────────────────
  const catMap = new Map<string, {
    active: number; blueSum: number; contested: number
    laws30: number; lawsPrev: number
  }>()

  for (const t of activeTopics) {
    const cat = t.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { active: 0, blueSum: 0, contested: 0, laws30: 0, lawsPrev: 0 })
    const c = catMap.get(cat)!
    c.active++
    c.blueSum += t.blue_pct ?? 50
    if (Math.abs((t.blue_pct ?? 50) - 50) <= 10) c.contested++
  }

  for (const l of laws30d) {
    const cat = l.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { active: 0, blueSum: 0, contested: 0, laws30: 0, lawsPrev: 0 })
    catMap.get(cat)!.laws30++
  }
  for (const l of lawsPrev) {
    const cat = l.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { active: 0, blueSum: 0, contested: 0, laws30: 0, lawsPrev: 0 })
    catMap.get(cat)!.lawsPrev++
  }

  const categories: TideCategoryRow[] = Array.from(catMap.entries())
    .filter(([, v]) => v.active > 0 || v.laws30 > 0)
    .map(([category, v]) => {
      const avg_blue_pct = v.active > 0 ? Math.round(v.blueSum / v.active) : 50
      const diff = v.laws30 - v.lawsPrev
      const trend: TideCategoryRow['trend'] = diff > 0 ? 'rising' : diff < 0 ? 'falling' : 'stable'
      return {
        category,
        active_topics: v.active,
        law_count_30d: v.laws30,
        law_count_prev: v.lawsPrev,
        avg_blue_pct,
        contested_count: v.contested,
        trend,
      }
    })
    .sort((a, b) => b.law_count_30d - a.law_count_30d || b.active_topics - a.active_topics)

  return NextResponse.json({
    days: Array.from(dayMap.values()),
    categories,
    platform,
    updated_at: now.toISOString(),
  } satisfies TideResponse, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  })
}
