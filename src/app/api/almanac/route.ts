import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ────────────────────────────────────────────────────────────

export interface AlmanacTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  year: number
}

export interface AlmanacLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  year: number
}

export interface AlmanacArgument {
  id: string
  topic_id: string
  topic_statement: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author_username: string | null
  author_display_name: string | null
  year: number
}

export interface AlmanacData {
  month: number
  day: number
  topics: AlmanacTopic[]
  laws: AlmanacLaw[]
  top_argument: AlmanacArgument | null
  total_events: number
  fun_fact: string | null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const now = new Date()

  // Allow ?date=MM-DD override for testing; defaults to today's M/D
  const dateParam = searchParams.get('date')
  let month: number
  let day: number

  if (dateParam && /^\d{1,2}-\d{1,2}$/.test(dateParam)) {
    const [m, d] = dateParam.split('-').map(Number)
    month = m
    day = d
  } else {
    month = now.getMonth() + 1
    day = now.getDate()
  }

  // Clamp to valid range
  month = Math.max(1, Math.min(12, month))
  day = Math.max(1, Math.min(31, day))

  // ── Topics proposed on this calendar date (any year) ──────────────────────
  // We use EXTRACT on the created_at timestamp so one query covers all years.
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .filter('created_at', 'not.is', null)
    .order('total_votes', { ascending: false })
    .limit(200)

  const topics: AlmanacTopic[] = (topicsRaw ?? [])
    .filter((t) => {
      const d = new Date(t.created_at)
      return d.getMonth() + 1 === month && d.getDate() === day
    })
    .map((t) => ({
      ...t,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      year: new Date(t.created_at).getFullYear(),
    }))
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 8)

  // ── Laws established on this calendar date ────────────────────────────────
  const { data: lawsRaw } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, established_at')
    .filter('established_at', 'not.is', null)
    .order('established_at', { ascending: false })
    .limit(200)

  const laws: AlmanacLaw[] = (lawsRaw ?? [])
    .filter((l) => {
      const d = new Date(l.established_at)
      return d.getMonth() + 1 === month && d.getDate() === day
    })
    .map((l) => ({
      ...l,
      year: new Date(l.established_at).getFullYear(),
    }))
    .slice(0, 5)

  // ── Top argument posted on this calendar date ─────────────────────────────
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, content, side, upvotes, created_at, user_id')
    .filter('created_at', 'not.is', null)
    .order('upvotes', { ascending: false })
    .limit(500)

  const argsOnDay = (argsRaw ?? []).filter((a) => {
    const d = new Date(a.created_at)
    return d.getMonth() + 1 === month && d.getDate() === day
  })

  let top_argument: AlmanacArgument | null = null

  if (argsOnDay.length > 0) {
    const best = argsOnDay.sort((a, b) => b.upvotes - a.upvotes)[0]

    // Fetch the topic statement
    const { data: topicRow } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', best.topic_id)
      .maybeSingle()

    // Fetch author profile
    const { data: authorRow } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', best.user_id)
      .maybeSingle()

    top_argument = {
      id: best.id,
      topic_id: best.topic_id,
      topic_statement: topicRow?.statement ?? 'Unknown topic',
      content: best.content,
      side: best.side as 'blue' | 'red',
      upvotes: best.upvotes,
      created_at: best.created_at,
      author_username: authorRow?.username ?? null,
      author_display_name: authorRow?.display_name ?? null,
      year: new Date(best.created_at).getFullYear(),
    }
  }

  // ── Fun civic fact for this date ──────────────────────────────────────────
  const FUN_FACTS: Record<string, string> = {
    '1-1':   "New Year's Day — a day for civic resolutions.",
    '2-14':  "Valentine's Day — Bipartisan love across the aisle.",
    '3-15':  "The Ides of March — beware the unexpected policy reversal.",
    '4-1':   "April Fool's Day — no fooling, every vote still counts.",
    '4-22':  "Earth Day — a perennial battleground for environmental legislation.",
    '5-1':   "May Day — International Workers Day, a civic anniversary worldwide.",
    '7-4':   "Independence Day — the original founding document was debated fiercely.",
    '9-17':  "U.S. Constitution Day — the founding document was signed in 1787.",
    '11-11': "Veterans Day / Armistice Day — marking the end of the Great War.",
    '11-8':  "U.S. Election Day falls near this date in even-numbered years.",
  }

  const key = `${month}-${day}`
  const fun_fact = FUN_FACTS[key] ?? null

  const total_events = topics.length + laws.length + (top_argument ? 1 : 0)

  return NextResponse.json({
    month,
    day,
    topics,
    laws,
    top_argument,
    total_events,
    fun_fact,
  } satisfies AlmanacData)
}
