import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptArgument {
  id: string
  content: string
  upvotes: number
  author: string | null
  author_avatar: string | null
  ai_grade: string | null
}

export interface TranscriptSummary {
  id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  blue_pct: number
  total_votes: number
  total_arguments: number
  resolved_at: string
  law_id: string | null
  top_for: TranscriptArgument | null
  top_against: TranscriptArgument | null
}

export interface TranscriptsResponse {
  transcripts: TranscriptSummary[]
  total: number
  has_more: boolean
  next_cursor: string | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const filter   = searchParams.get('filter') ?? 'all'   // all | law | failed
  const category = searchParams.get('category') ?? null
  const sort     = searchParams.get('sort') ?? 'recent'  // recent | votes | arguments
  const query    = searchParams.get('q') ?? null
  const limit    = Math.min(Math.max(1, Number.parseInt(searchParams.get('limit') ?? '20', 10) || 20), 50)
  const cursor   = searchParams.get('cursor') ?? null

  type Status = 'law' | 'failed'
  const statuses: Status[] =
    filter === 'law'    ? ['law']    :
    filter === 'failed' ? ['failed'] :
    ['law', 'failed']

  // ── 1. Fetch resolved topics ───────────────────────────────────────────────
  let topicQuery = supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, total_votes, total_arguments, updated_at'
    )
    .in('status', statuses)

  if (category) {
    topicQuery = topicQuery.eq('category', category)
  }

  if (query) {
    topicQuery = topicQuery.ilike('statement', `%${query}%`)
  }

  if (cursor) {
    if (sort === 'votes') {
      topicQuery = topicQuery.lt('total_votes', Number.parseInt(cursor, 10))
    } else if (sort === 'arguments') {
      topicQuery = topicQuery.lt('total_arguments', Number.parseInt(cursor, 10))
    } else {
      topicQuery = topicQuery.lt('updated_at', cursor)
    }
  }

  if (sort === 'votes') {
    topicQuery = topicQuery.order('total_votes', { ascending: false })
  } else if (sort === 'arguments') {
    topicQuery = topicQuery.order('total_arguments', { ascending: false })
  } else {
    topicQuery = topicQuery.order('updated_at', { ascending: false })
  }

  topicQuery = topicQuery.limit(limit + 1)

  const { data: topicRows, error } = await topicQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topics = topicRows ?? []
  const has_more = topics.length > limit
  if (has_more) topics.pop()

  if (topics.length === 0) {
    return NextResponse.json<TranscriptsResponse>({
      transcripts: [],
      total: 0,
      has_more: false,
      next_cursor: null,
    })
  }

  const topicIds = topics.map((t) => t.id)

  // ── 2. Fetch top FOR argument per topic ────────────────────────────────────
  const { data: forArgs } = await supabase
    .from('topic_arguments')
    .select(
      'id, topic_id, content, upvotes, ai_grade, profiles:user_id (username, avatar_url)'
    )
    .in('topic_id', topicIds)
    .eq('side', 'blue')
    .order('upvotes', { ascending: false })
    .limit(topicIds.length * 3)

  // ── 3. Fetch top AGAINST argument per topic ────────────────────────────────
  const { data: againstArgs } = await supabase
    .from('topic_arguments')
    .select(
      'id, topic_id, content, upvotes, ai_grade, profiles:user_id (username, avatar_url)'
    )
    .in('topic_id', topicIds)
    .eq('side', 'red')
    .order('upvotes', { ascending: false })
    .limit(topicIds.length * 3)

  // ── 4. Fetch law_ids for topics that became law ────────────────────────────
  const lawTopicIds = topics.filter((t) => t.status === 'law').map((t) => t.id)
  const lawMap: Record<string, string> = {}
  if (lawTopicIds.length > 0) {
    const { data: laws } = await supabase
      .from('laws')
      .select('id, topic_id')
      .in('topic_id', lawTopicIds)
    for (const law of laws ?? []) {
      lawMap[law.topic_id] = law.id
    }
  }

  // ── 5. Build top-argument maps keyed by topic_id ──────────────────────────

  type RawArg = {
    id: string
    topic_id: string
    content: string
    upvotes: number
    ai_grade: string | null
    profiles: { username: string; avatar_url: string | null } | null
  }

  function pickTop(rows: RawArg[] | null, topicId: string): TranscriptArgument | null {
    const match = (rows ?? []).find((r) => r.topic_id === topicId)
    if (!match) return null
    return {
      id: match.id,
      content: match.content,
      upvotes: match.upvotes,
      author: match.profiles?.username ?? null,
      author_avatar: match.profiles?.avatar_url ?? null,
      ai_grade: match.ai_grade,
    }
  }

  const lastTopic = topics[topics.length - 1]
  const nextCursor = has_more
    ? sort === 'votes'     ? String(lastTopic.total_votes)
    : sort === 'arguments' ? String(lastTopic.total_arguments)
    : lastTopic.updated_at
    : null

  const transcripts: TranscriptSummary[] = topics.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status as 'law' | 'failed',
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    total_arguments: t.total_arguments ?? 0,
    resolved_at: t.updated_at,
    law_id: lawMap[t.id] ?? null,
    top_for: pickTop(forArgs as RawArg[] | null, t.id),
    top_against: pickTop(againstArgs as RawArg[] | null, t.id),
  }))

  return NextResponse.json<TranscriptsResponse>({
    transcripts,
    total: topics.length,
    has_more,
    next_cursor: nextCursor,
  })
}
