import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ArchiveDay {
  date: string        // YYYY-MM-DD
  edition: number
  laws_count: number
  topics_count: number
  votes_count: number
  arguments_count: number
  has_debate: boolean
}

export interface ArchiveMonth {
  year: number
  month: number       // 1-based
  label: string       // "June 2026"
  days: ArchiveDay[]
}

export interface GazetteArchiveResponse {
  months: ArchiveMonth[]
  total_editions: number
  total_laws: number
  first_date: string | null
  today: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToEdition(dateStr: string): number {
  const d = new Date(dateStr)
  const launch = new Date('2024-01-01')
  const diff = Math.floor((d.getTime() - launch.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff + 1)
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function getDatesForMonth(year: number, month: number, today: string): string[] {
  const days: string[] = []
  const end = new Date(year, month, 0) // last day of month
  const todayDate = new Date(today)
  for (let d = 1; d <= end.getDate(); d++) {
    const candidate = new Date(year, month - 1, d)
    if (candidate <= todayDate) {
      const pad = (n: number) => String(n).padStart(2, '0')
      days.push(`${year}-${pad(month)}-${pad(d)}`)
    }
  }
  return days
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)

  // ── 1. Earliest topic (determines first gazette edition) ─────────────────
  const { data: firstTopicRow } = await supabase
    .from('topics')
    .select('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const firstDate: string = firstTopicRow?.created_at
    ? firstTopicRow.created_at.slice(0, 10)
    : today

  // ── 2. Laws per day (last 90 days max for performance) ───────────────────
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const since = ninetyDaysAgo.toISOString().slice(0, 10) < firstDate
    ? firstDate
    : ninetyDaysAgo.toISOString().slice(0, 10)

  const { data: lawsRaw } = await supabase
    .from('topics')
    .select('voting_ends_at')
    .eq('status', 'law')
    .gte('voting_ends_at', `${since}T00:00:00Z`)
    .lte('voting_ends_at', `${today}T23:59:59Z`)

  // Group laws by date
  const lawsByDate: Record<string, number> = {}
  for (const l of lawsRaw ?? []) {
    if (!l.voting_ends_at) continue
    const d = l.voting_ends_at.slice(0, 10)
    lawsByDate[d] = (lawsByDate[d] ?? 0) + 1
  }

  // ── 3. Topics created per day ────────────────────────────────────────────
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('created_at')
    .gte('created_at', `${since}T00:00:00Z`)
    .lte('created_at', `${today}T23:59:59Z`)

  const topicsByDate: Record<string, number> = {}
  for (const t of topicsRaw ?? []) {
    const d = t.created_at.slice(0, 10)
    topicsByDate[d] = (topicsByDate[d] ?? 0) + 1
  }

  // ── 4. Votes per day ─────────────────────────────────────────────────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('created_at')
    .gte('created_at', `${since}T00:00:00Z`)
    .lte('created_at', `${today}T23:59:59Z`)

  const votesByDate: Record<string, number> = {}
  for (const v of votesRaw ?? []) {
    const d = v.created_at.slice(0, 10)
    votesByDate[d] = (votesByDate[d] ?? 0) + 1
  }

  // ── 5. Arguments per day ─────────────────────────────────────────────────
  const { data: argsRaw } = await supabase
    .from('arguments')
    .select('created_at')
    .gte('created_at', `${since}T00:00:00Z`)
    .lte('created_at', `${today}T23:59:59Z`)

  const argsByDate: Record<string, number> = {}
  for (const a of argsRaw ?? []) {
    const d = a.created_at.slice(0, 10)
    argsByDate[d] = (argsByDate[d] ?? 0) + 1
  }

  // ── 6. Debates per day ───────────────────────────────────────────────────
  const { data: debatesRaw } = await supabase
    .from('debates')
    .select('starts_at')
    .gte('starts_at', `${since}T00:00:00Z`)
    .lte('starts_at', `${today}T23:59:59Z`)

  const debatesByDate: Record<string, boolean> = {}
  for (const d of debatesRaw ?? []) {
    if (!d.starts_at) continue
    const date = d.starts_at.slice(0, 10)
    debatesByDate[date] = true
  }

  // ── 7. Build months ──────────────────────────────────────────────────────
  const todayObj = new Date(today)
  const sinceObj = new Date(since)

  // Collect all year-months from sinceObj to today
  const yearMonths: { year: number; month: number }[] = []
  const cursor = new Date(sinceObj.getFullYear(), sinceObj.getMonth(), 1)
  const endCursor = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1)

  while (cursor <= endCursor) {
    yearMonths.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const months: ArchiveMonth[] = yearMonths.reverse().map(({ year, month }) => {
    const dates = getDatesForMonth(year, month, today)
    const days: ArchiveDay[] = dates.map((date) => ({
      date,
      edition: dateToEdition(date),
      laws_count: lawsByDate[date] ?? 0,
      topics_count: topicsByDate[date] ?? 0,
      votes_count: votesByDate[date] ?? 0,
      arguments_count: argsByDate[date] ?? 0,
      has_debate: debatesByDate[date] ?? false,
    }))

    return {
      year,
      month,
      label: monthLabel(year, month),
      days,
    }
  })

  const totalLaws = Object.values(lawsByDate).reduce((a, b) => a + b, 0)

  const response: GazetteArchiveResponse = {
    months,
    total_editions: dateToEdition(today),
    total_laws: totalLaws,
    first_date: firstDate,
    today,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
  })
}
