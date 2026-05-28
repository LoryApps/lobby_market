import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChronicleEventType = 'law' | 'debate' | 'topic' | 'milestone'

export interface ChronicleEvent {
  id: string
  type: ChronicleEventType
  title: string
  subtitle: string | null
  date: string           // ISO date string
  category: string | null
  votes: number | null
  blue_pct: number | null
  // debate-specific
  debate_type: string | null
  debate_status: string | null
}

export interface ChronicleMonth {
  label: string           // "May 2026"
  year: number
  month: number
  events: ChronicleEvent[]
  stats: {
    laws: number
    debates: number
    topics: number
  }
}

export interface ChronicleResponse {
  months: ChronicleMonth[]
  totals: {
    laws: number
    debates: number
    topics: number
  }
  first_event_date: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })
}

function toMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const typeFilter = searchParams.get('type') ?? 'all'    // 'all' | 'law' | 'debate' | 'topic'
  const categoryFilter = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '200', 10), 500)

  try {
    const supabase = await createClient()

    // ── 1. Fetch laws ────────────────────────────────────────────────────────

    let lawsQuery = supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at')
      .eq('is_active', true)
      .order('established_at', { ascending: false })
      .limit(limit)

    if (categoryFilter) lawsQuery = lawsQuery.eq('category', categoryFilter)

    const { data: laws } = await lawsQuery

    // ── 2. Fetch debates ─────────────────────────────────────────────────────

    const { data: debates } = await supabase
      .from('debates')
      .select('id, title, topic_id, debate_type, status, scheduled_at')
      .not('scheduled_at', 'is', null)
      .in('status', ['live', 'ended'])
      .order('scheduled_at', { ascending: false })
      .limit(150)

    // ── 3. Fetch notable topic proposals (high-vote topics) ──────────────────

    let topicsQuery = supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, created_at, status')
      .gte('total_votes', 50)
      .order('created_at', { ascending: false })
      .limit(150)

    if (categoryFilter) topicsQuery = topicsQuery.eq('category', categoryFilter)

    const { data: topicRows } = await topicsQuery

    // ── 4. Assemble events ───────────────────────────────────────────────────

    const allEvents: ChronicleEvent[] = []

    for (const law of laws ?? []) {
      if (!law.established_at) continue
      allEvents.push({
        id: `law-${law.id}`,
        type: 'law',
        title: law.statement,
        subtitle: null,
        date: law.established_at,
        category: law.category,
        votes: law.total_votes ?? null,
        blue_pct: law.blue_pct ?? null,
        debate_type: null,
        debate_status: null,
      })
    }

    for (const debate of debates ?? []) {
      if (!debate.scheduled_at) continue
      allEvents.push({
        id: `debate-${debate.id}`,
        type: 'debate',
        title: debate.title ?? 'Civic Debate',
        subtitle: null,
        date: debate.scheduled_at,
        category: null,
        votes: null,
        blue_pct: null,
        debate_type: debate.debate_type ?? null,
        debate_status: debate.status ?? null,
      })
    }

    for (const topic of topicRows ?? []) {
      if (!topic.created_at) continue
      allEvents.push({
        id: `topic-${topic.id}`,
        type: 'topic',
        title: topic.statement,
        subtitle: topic.status === 'law' ? 'Became Law' : null,
        date: topic.created_at,
        category: topic.category,
        votes: topic.total_votes ?? null,
        blue_pct: topic.blue_pct ?? null,
        debate_type: null,
        debate_status: null,
      })
    }

    // ── 5. Filter by type ────────────────────────────────────────────────────

    const filtered = typeFilter === 'all'
      ? allEvents
      : allEvents.filter((e) => e.type === typeFilter)

    // Sort all events newest-first
    filtered.sort((a, b) => b.date.localeCompare(a.date))

    // ── 6. Group into months ─────────────────────────────────────────────────

    const monthMap = new Map<string, ChronicleMonth>()

    for (const event of filtered) {
      const key = toMonthKey(event.date)
      const [yearStr, monthStr] = key.split('-')
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          label: monthLabel(year, month),
          year,
          month,
          events: [],
          stats: { laws: 0, debates: 0, topics: 0 },
        })
      }

      const m = monthMap.get(key)!
      m.events.push(event)

      if (event.type === 'law') m.stats.laws++
      else if (event.type === 'debate') m.stats.debates++
      else if (event.type === 'topic') m.stats.topics++
    }

    // Sort months newest-first
    const months = Array.from(monthMap.values()).sort(
      (a, b) => b.year - a.year || b.month - a.month,
    )

    // ── 7. Totals ─────────────────────────────────────────────────────────────

    const totals = {
      laws: (laws ?? []).length,
      debates: (debates ?? []).length,
      topics: (topicRows ?? []).length,
    }

    const allDates = allEvents.map((e) => e.date).sort()
    const first_event_date = allDates[0] ?? null

    return NextResponse.json({
      months,
      totals,
      first_event_date,
    } satisfies ChronicleResponse)
  } catch (err) {
    console.error('/api/chronicle error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
