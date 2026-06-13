import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface GazetteLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
}

export interface GazetteTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
}

export interface GazetteArgument {
  id: string
  content: string
  side: string
  upvotes: number
  topic_id: string
  topic_statement: string
  ai_score: number | null
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  created_at: string
}

export interface GazetteVoice {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  votes_today: number
  arguments_today: number
}

export interface GazetteStats {
  votes_today: number
  topics_created: number
  laws_established: number
  arguments_written: number
  debates_held: number
}

export interface GazetteData {
  date: string
  edition_number: number
  top_law: GazetteLaw | null
  featured_debate: GazetteTopic | null
  rising_topics: GazetteTopic[]
  top_argument: GazetteArgument | null
  stats: GazetteStats
  top_voice: GazetteVoice | null
  previous_date: string | null
  next_date: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToEdition(dateStr: string): number {
  const d = new Date(dateStr)
  const launch = new Date('2024-01-01')
  const diff = Math.floor((d.getTime() - launch.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff + 1)
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── GET /api/gazette?date=YYYY-MM-DD ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const rawDate = searchParams.get('date') ?? todayUTC()

  // Validate format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }

  const date = rawDate
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`
  const today = todayUTC()

  const supabase = await createClient()

  // ── 1. Top law established today (or most recent law if none today) ────────
  const { data: todayLaws } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, voting_ends_at, created_at')
    .eq('status', 'law')
    .gte('voting_ends_at', dayStart)
    .lte('voting_ends_at', dayEnd)
    .order('total_votes', { ascending: false })
    .limit(1)

  let topLaw: GazetteLaw | null = null

  if (todayLaws && todayLaws.length > 0) {
    const l = todayLaws[0]
    topLaw = {
      id: l.id,
      statement: l.statement,
      category: l.category,
      blue_pct: l.blue_pct ?? 50,
      total_votes: l.total_votes ?? 0,
      established_at: l.voting_ends_at ?? l.created_at,
    }
  }

  // ── 2. Featured debate — most-voted active/voting topic ───────────────────
  const { data: activeTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(1)

  const featuredDebate: GazetteTopic | null =
    activeTopics && activeTopics.length > 0
      ? {
          id: activeTopics[0].id,
          statement: activeTopics[0].statement,
          category: activeTopics[0].category,
          status: activeTopics[0].status,
          blue_pct: activeTopics[0].blue_pct ?? 50,
          total_votes: activeTopics[0].total_votes ?? 0,
          view_count: activeTopics[0].view_count ?? 0,
          created_at: activeTopics[0].created_at,
        }
      : null

  // ── 3. Rising topics — new topics created today ───────────────────────────
  const { data: risingRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('total_votes', { ascending: false })
    .limit(5)

  const risingTopics: GazetteTopic[] = (risingRaw ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    view_count: t.view_count ?? 0,
    created_at: t.created_at,
  }))

  // ── 4. Top argument — most upvoted argument created today ────────────────
  const { data: argRaw } = await supabase
    .from('arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      ai_score,
      topic_id,
      author_id,
      created_at,
      topics!inner(statement),
      profiles!inner(username, display_name, avatar_url, role)
    `)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .order('upvotes', { ascending: false })
    .limit(1)

  let topArgument: GazetteArgument | null = null
  if (argRaw && argRaw.length > 0) {
    const a = argRaw[0] as {
      id: string
      content: string
      side: string
      upvotes: number
      ai_score: number | null
      topic_id: string
      author_id: string
      created_at: string
      topics: { statement: string }
      profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string }
    }
    topArgument = {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes ?? 0,
      ai_score: a.ai_score,
      topic_id: a.topic_id,
      topic_statement: a.topics.statement,
      author_id: a.author_id,
      author_username: a.profiles.username,
      author_display_name: a.profiles.display_name,
      author_avatar_url: a.profiles.avatar_url,
      author_role: a.profiles.role,
      created_at: a.created_at,
    }
  }

  // ── 5. Daily stats ────────────────────────────────────────────────────────
  const [votesRes, topicsRes, lawsRes, argsRes] = await Promise.all([
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'law')
      .gte('voting_ends_at', dayStart)
      .lte('voting_ends_at', dayEnd),
    supabase
      .from('arguments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
  ])

  const stats: GazetteStats = {
    votes_today: votesRes.count ?? 0,
    topics_created: topicsRes.count ?? 0,
    laws_established: lawsRes.count ?? 0,
    arguments_written: argsRes.count ?? 0,
    debates_held: 0,
  }

  // ── 6. Top voice of the day — most active contributor ───────────────────
  // Votes cast today, grouped by user
  const { data: voterRaw } = await supabase
    .from('votes')
    .select('user_id')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .limit(500)

  let topVoice: GazetteVoice | null = null

  if (voterRaw && voterRaw.length > 0) {
    const counts: Record<string, number> = {}
    for (const v of voterRaw) {
      counts[v.user_id] = (counts[v.user_id] ?? 0) + 1
    }
    const topUserId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (topUserId) {
      const { data: profileRaw } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .eq('id', topUserId)
        .single()

      if (profileRaw) {
        // Count their arguments today
        const { count: argCount } = await supabase
          .from('arguments')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', topUserId)
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)

        topVoice = {
          user_id: profileRaw.id,
          username: profileRaw.username,
          display_name: profileRaw.display_name,
          avatar_url: profileRaw.avatar_url,
          role: profileRaw.role,
          clout: profileRaw.clout ?? 0,
          votes_today: counts[topUserId] ?? 0,
          arguments_today: argCount ?? 0,
        }
      }
    }
  }

  // ── 7. Previous / next date navigation ──────────────────────────────────
  const previousDate = offsetDate(date, -1)
  const nextDate = date < today ? offsetDate(date, 1) : null

  const data: GazetteData = {
    date,
    edition_number: dateToEdition(date),
    top_law: topLaw,
    featured_debate: featuredDebate,
    rising_topics: risingTopics,
    top_argument: topArgument,
    stats,
    top_voice: topVoice,
    previous_date: previousDate,
    next_date: nextDate,
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
