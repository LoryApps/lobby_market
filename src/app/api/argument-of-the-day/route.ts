import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyArgument {
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

export interface ArchiveEntry {
  date: string        // YYYY-MM-DD in UTC
  dateLabel: string   // e.g. "Monday, May 12"
  argument: DailyArgument | null
}

export interface ArgumentOfTheDayResponse {
  today: DailyArgument | null
  todayDate: string
  archive: ArchiveEntry[]
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function utcDateStr(daysAgo: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function compositeScore(upvotes: number, aiScore: number | null): number {
  // upvotes weighted 3x, ai_score (1–10) weighted 10x
  return upvotes * 3 + (aiScore ?? 0) * 10
}

async function fetchBestForDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateStr: string,
): Promise<DailyArgument | null> {
  const dayStart = dateStr + 'T00:00:00.000Z'
  const dayEnd = dateStr + 'T23:59:59.999Z'

  const { data, error } = await supabase
    .from('topic_arguments')
    .select(
      `
      id, topic_id, user_id, side, content, upvotes, ai_score, ai_grade, source_url, created_at,
      author:profiles!user_id ( id, username, display_name, avatar_url, role, clout ),
      topic:topics!topic_id ( id, statement, category, status, blue_pct, total_votes )
    `,
    )
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('upvotes', { ascending: false })
    .order('ai_score', { ascending: false, nullsFirst: false })
    .limit(30)

  if (error || !data || data.length === 0) return null

  // Pick the argument with the highest composite score
  type RawRow = typeof data[number]

  const ranked = (data as RawRow[])
    .map((row) => {
      const score = compositeScore(
        row.upvotes ?? 0,
        row.ai_score as number | null,
      )
      return { row, score }
    })
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return null

  const { row, score } = ranked[0]

  const author = Array.isArray(row.author)
    ? (row.author[0] ?? null)
    : (row.author as DailyArgument['author'])
  const topic = Array.isArray(row.topic)
    ? (row.topic[0] ?? null)
    : (row.topic as DailyArgument['topic'])

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
    author,
    topic,
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const todayStr = utcDateStr(0)

  // Fetch today + previous 7 days in parallel
  const days = Array.from({ length: 8 }, (_, i) => utcDateStr(i))
  const results = await Promise.all(days.map((d) => fetchBestForDay(supabase, d)))

  const [todayArg, ...pastArgs] = results

  const archive: ArchiveEntry[] = days.slice(1).map((d, i) => ({
    date: d,
    dateLabel: dateLabel(d),
    argument: pastArgs[i] ?? null,
  }))

  return NextResponse.json({
    today: todayArg,
    todayDate: todayStr,
    archive,
    generatedAt: new Date().toISOString(),
  } satisfies ArgumentOfTheDayResponse)
}
