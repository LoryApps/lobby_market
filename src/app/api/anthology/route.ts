import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnthologyArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  source_url: string | null
  created_at: string
  composite_score: number
  rank: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface AnthologyEdition {
  editionLabel: string   // e.g. "Monday, May 18, 2026" or "Week of May 12–18, 2026"
  editionKey: string     // e.g. "2026-05-18" or "2026-W20"
  arguments: AnthologyArgument[]
  totalConsidered: number
}

export interface AnthologyResponse {
  daily: AnthologyEdition
  weekly: AnthologyEdition
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compositeScore(upvotes: number, aiScore: number | null): number {
  return upvotes * 3 + (aiScore ?? 0) * 10
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekBounds(): { start: string; end: string; label: string; key: string } {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sun
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7))
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

  const isoWeek = (d: Date) => {
    const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
    const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getUTCDay() + 1) / 7)
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }

  return {
    start: monday.toISOString().slice(0, 10) + 'T00:00:00.000Z',
    end: sunday.toISOString().slice(0, 10) + 'T23:59:59.999Z',
    label: `Week of ${fmt(monday)}–${fmt(sunday)}, ${sunday.getUTCFullYear()}`,
    key: isoWeek(monday),
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function fetchTopArguments(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
  limit: number,
): Promise<{ args: AnthologyArgument[]; total: number }> {
  const { data, error } = await supabase
    .from('topic_arguments')
    .select(
      `
      id, topic_id, user_id, side, content, upvotes, ai_score, ai_grade, source_url, created_at,
      author:profiles!user_id ( id, username, display_name, avatar_url, role, clout ),
      topic:topics!topic_id ( id, statement, category, status, blue_pct, total_votes )
    `,
    )
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd)
    .gte('upvotes', 1)
    .order('upvotes', { ascending: false })
    .order('ai_score', { ascending: false, nullsFirst: false })
    .limit(200)

  if (error || !data || data.length === 0) return { args: [], total: 0 }

  type RawRow = (typeof data)[number]

  const normalise = (row: RawRow, rank: number): AnthologyArgument => {
    const author = Array.isArray(row.author)
      ? ((row.author[0] ?? null) as AnthologyArgument['author'])
      : (row.author as AnthologyArgument['author'])
    const topic = Array.isArray(row.topic)
      ? ((row.topic[0] ?? null) as AnthologyArgument['topic'])
      : (row.topic as AnthologyArgument['topic'])
    const score = compositeScore(row.upvotes ?? 0, row.ai_score as number | null)
    return {
      id: row.id,
      topic_id: row.topic_id,
      user_id: row.user_id,
      side: row.side as 'blue' | 'red',
      content: row.content,
      upvotes: row.upvotes ?? 0,
      ai_score: row.ai_score as number | null,
      ai_grade: row.ai_grade as string | null,
      source_url: row.source_url as string | null,
      created_at: row.created_at,
      composite_score: score,
      rank,
      author,
      topic,
    }
  }

  const total = data.length
  const ranked = [...data]
    .map((row) => ({ row, score: compositeScore(row.upvotes ?? 0, row.ai_score as number | null) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }, i) => normalise(row as RawRow, i + 1))

  return { args: ranked, total }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const today = utcToday()
  const dayStart = today + 'T00:00:00.000Z'
  const dayEnd = today + 'T23:59:59.999Z'

  const week = weekBounds()

  const [dailyResult, weeklyResult] = await Promise.all([
    fetchTopArguments(supabase, dayStart, dayEnd, 5),
    fetchTopArguments(supabase, week.start, week.end, 15),
  ])

  const dailyLabel = new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return NextResponse.json({
    daily: {
      editionLabel: dailyLabel,
      editionKey: today,
      arguments: dailyResult.args,
      totalConsidered: dailyResult.total,
    },
    weekly: {
      editionLabel: week.label,
      editionKey: week.key,
      arguments: weeklyResult.args,
      totalConsidered: weeklyResult.total,
    },
    generatedAt: new Date().toISOString(),
  } satisfies AnthologyResponse)
}
