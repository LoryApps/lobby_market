import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number
  voting_ends_at: string
  days_until: number        // negative = overdue
  hours_until: number       // within the final 24h
  is_overdue: boolean
  is_urgent: boolean        // closes within 24h
  is_near_law: boolean
  is_deadlocked: boolean
}

export interface CalendarGroup {
  label: string             // "Today", "Tomorrow", "This Week", "Next Week", date string
  date_key: string          // YYYY-MM-DD
  markets: CalendarMarket[]
}

export interface CalendarResponse {
  groups: CalendarGroup[]
  total: number
  overdue_count: number
  closing_today: number
  as_of: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() + 90) // show up to 90 days ahead

    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at')
      .not('voting_ends_at', 'is', null)
      .not('status', 'in', '("proposed","law","failed")')
      .lte('voting_ends_at', cutoff.toISOString())
      .order('voting_ends_at', { ascending: true })
      .limit(200)

    if (error || !topics) {
      return NextResponse.json(
        { groups: [], total: 0, overdue_count: 0, closing_today: 0, as_of: now.toISOString() },
        { status: error ? 500 : 200 },
      )
    }

    function getDayLabel(dateStr: string): string {
      const d = new Date(dateStr)
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const tomorrowStart = new Date(todayStart)
      tomorrowStart.setDate(tomorrowStart.getDate() + 1)
      const dayAfterStart = new Date(tomorrowStart)
      dayAfterStart.setDate(dayAfterStart.getDate() + 1)
      const weekEnd = new Date(todayStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const nextWeekEnd = new Date(weekEnd)
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7)

      if (d < now) return 'Overdue'
      if (d < tomorrowStart) return 'Today'
      if (d < dayAfterStart) return 'Tomorrow'
      if (d < weekEnd) return 'This Week'
      if (d < nextWeekEnd) return 'Next Week'
      return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    }

    function getDateKey(dateStr: string): string {
      const d = new Date(dateStr)
      if (d < now) return '__overdue__'
      // Group by label bucket, not exact date
      const label = getDayLabel(dateStr)
      if (label === 'Today') return '__today__'
      if (label === 'Tomorrow') return '__tomorrow__'
      if (label === 'This Week') return '__this_week__'
      if (label === 'Next Week') return '__next_week__'
      // Monthly grouping
      return d.toISOString().slice(0, 7) // YYYY-MM
    }

    const groupMap = new Map<string, { label: string; markets: CalendarMarket[] }>()

    let overdue_count = 0
    let closing_today = 0

    for (const t of topics) {
      const ends = new Date(t.voting_ends_at)
      const msUntil = ends.getTime() - now.getTime()
      const hoursUntil = msUntil / (1000 * 60 * 60)
      const daysUntil = hoursUntil / 24
      const isOverdue = msUntil < 0
      const isUrgent = !isOverdue && hoursUntil < 24

      if (isOverdue) overdue_count++
      if (isUrgent) closing_today++

      const price = Math.round(t.blue_pct ?? 50)
      const market: CalendarMarket = {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        price,
        volume: t.total_votes ?? 0,
        voting_ends_at: t.voting_ends_at,
        days_until: Math.floor(daysUntil),
        hours_until: Math.floor(hoursUntil % 24),
        is_overdue: isOverdue,
        is_urgent: isUrgent,
        is_near_law: price >= 65,
        is_deadlocked: price >= 40 && price <= 60,
      }

      const key = getDateKey(t.voting_ends_at)
      const label = getDayLabel(t.voting_ends_at)

      if (!groupMap.has(key)) {
        groupMap.set(key, { label, markets: [] })
      }
      groupMap.get(key)!.markets.push(market)
    }

    // Sort groups in chronological order
    const KEY_ORDER = ['__overdue__', '__today__', '__tomorrow__', '__this_week__', '__next_week__']

    const groups: CalendarGroup[] = [...groupMap.entries()]
      .sort(([a], [b]) => {
        const ai = KEY_ORDER.indexOf(a)
        const bi = KEY_ORDER.indexOf(b)
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        return a.localeCompare(b)
      })
      .map(([date_key, g]) => ({
        date_key,
        label: g.label,
        markets: g.markets,
      }))

    return NextResponse.json({
      groups,
      total: topics.length,
      overdue_count,
      closing_today,
      as_of: now.toISOString(),
    } satisfies CalendarResponse)
  } catch (err) {
    console.error('[/api/exchange/calendar]', err)
    return NextResponse.json(
      { groups: [], total: 0, overdue_count: 0, closing_today: 0, as_of: new Date().toISOString() },
      { status: 500 },
    )
  }
}
