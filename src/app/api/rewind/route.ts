import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RewindLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface RewindDebate {
  id: string
  title: string
  type: string
  topic_statement: string | null
  topic_category: string | null
  topic_id: string | null
  ended_at: string
}

export interface RewindStatusChange {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  updated_at: string
}

export interface RewindArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  topic_id: string
  topic_statement: string | null
  created_at: string
}

export interface RewindStats {
  laws_count: number
  debates_count: number
  topics_changed: number
  top_arguments: number
  total_votes_cast: number
}

export interface RewindResponse {
  date: string
  stats: RewindStats
  laws: RewindLaw[]
  debates: RewindDebate[]
  status_changes: RewindStatusChange[]
  top_arguments: RewindArgument[]
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')

  // Default to yesterday if no date provided
  const today = new Date()
  today.setDate(today.getDate() - 1)
  const defaultDate = today.toISOString().slice(0, 10)

  const date = dateParam ?? defaultDate

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
  }

  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  const supabase = await createClient()

  // Run queries in parallel
  const [lawsResult, debatesResult, topicsResult, argumentsResult] = await Promise.all([
    // Laws established on this day (denormalized — no join needed)
    supabase
      .from('laws')
      .select('id, topic_id, established_at, statement, category, total_votes, blue_pct')
      .gte('established_at', dayStart)
      .lte('established_at', dayEnd)
      .order('established_at', { ascending: false })
      .limit(20) as Promise<{ data: { id: string; topic_id: string; established_at: string; statement: string; category: string | null; total_votes: number; blue_pct: number }[] | null; error: unknown }>,

    // Debates that ended on this day
    supabase
      .from('debates')
      .select('id, title, type, topic_id, ended_at')
      .eq('status', 'ended')
      .gte('ended_at', dayStart)
      .lte('ended_at', dayEnd)
      .order('ended_at', { ascending: false })
      .limit(20) as Promise<{ data: { id: string; title: string; type: string; topic_id: string; ended_at: string }[] | null; error: unknown }>,

    // Topics that changed status on this day
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('status', ['active', 'voting', 'failed'])
      .gte('updated_at', dayStart)
      .lte('updated_at', dayEnd)
      .order('total_votes', { ascending: false })
      .limit(20) as Promise<{ data: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number; updated_at: string }[] | null; error: unknown }>,

    // Top arguments from this day
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, user_id, created_at')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('upvotes', { ascending: false })
      .limit(8) as Promise<{ data: { id: string; content: string; side: 'blue' | 'red'; upvotes: number; topic_id: string; user_id: string; created_at: string }[] | null; error: unknown }>,
  ])

  // Shape laws
  const laws: RewindLaw[] = (lawsResult.data ?? []).map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    statement: row.statement ?? '',
    category: row.category ?? null,
    total_votes: row.total_votes ?? 0,
    blue_pct: row.blue_pct ?? 50,
    established_at: row.established_at,
  }))

  // Shape debates — need to fetch topic info for those with topic_id
  const debateTopicIds = (debatesResult.data ?? [])
    .map((d) => d.topic_id)
    .filter(Boolean)

  const debateTopicMap = new Map<string, { statement: string; category: string | null }>()
  if (debateTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', debateTopicIds)
    for (const t of topicRows ?? []) {
      debateTopicMap.set(t.id, { statement: t.statement, category: t.category })
    }
  }

  const debates: RewindDebate[] = (debatesResult.data ?? []).map((d) => {
    const topic = d.topic_id ? debateTopicMap.get(d.topic_id) : undefined
    return {
      id: d.id,
      title: d.title,
      type: d.type,
      topic_id: d.topic_id ?? null,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      ended_at: d.ended_at,
    }
  })

  // Shape status changes
  const statusChanges: RewindStatusChange[] = (topicsResult.data ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    updated_at: t.updated_at,
  }))

  // Fetch profiles and topic statements for arguments
  const argRows = argumentsResult.data ?? []
  const argUserIds = Array.from(new Set(argRows.map((a) => a.user_id).filter(Boolean)))
  const argTopicIds2 = Array.from(new Set(argRows.map((a) => a.topic_id).filter(Boolean)))

  const [argProfilesResult, argTopicsResult] = await Promise.all([
    argUserIds.length > 0
      ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', argUserIds) as Promise<{ data: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] | null; error: unknown }>
      : Promise.resolve({ data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null }[], error: null }),
    argTopicIds2.length > 0
      ? supabase.from('topics').select('id, statement').in('id', argTopicIds2) as Promise<{ data: { id: string; statement: string }[] | null; error: unknown }>
      : Promise.resolve({ data: [] as { id: string; statement: string }[], error: null }),
  ])

  const argProfileMap = new Map(
    (argProfilesResult.data ?? []).map((p) => [p.id, p])
  )
  const argTopicMap = new Map(
    (argTopicsResult.data ?? []).map((t) => [t.id, t.statement])
  )

  const topArguments: RewindArgument[] = argRows.map((a) => {
    const profile = argProfileMap.get(a.user_id)
    return {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes ?? 0,
      author_username: profile?.username ?? null,
      author_display_name: profile?.display_name ?? null,
      author_avatar_url: profile?.avatar_url ?? null,
      topic_id: a.topic_id,
      topic_statement: argTopicMap.get(a.topic_id) ?? null,
      created_at: a.created_at,
    }
  })

  const stats: RewindStats = {
    laws_count: laws.length,
    debates_count: debates.length,
    topics_changed: statusChanges.length,
    top_arguments: topArguments.length,
    total_votes_cast: 0,
  }

  return NextResponse.json({
    date,
    stats,
    laws,
    debates,
    status_changes: statusChanges,
    top_arguments: topArguments,
  } satisfies RewindResponse)
}
