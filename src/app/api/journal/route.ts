import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type JournalMood = 'hopeful' | 'concerned' | 'neutral' | 'confident' | 'uncertain'

export interface JournalTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface JournalEntry {
  id: string
  user_id: string
  topic_id: string | null
  content: string
  is_public: boolean
  vote_snapshot: { blue_pct: number; total_votes: number; status: string } | null
  mood: JournalMood | null
  created_at: string
  updated_at: string
  topic: JournalTopic | null
}

export interface JournalResponse {
  entries: JournalEntry[]
  total: number
}

// ─── GET /api/journal ─────────────────────────────────────────────────────────
// Returns the current user's journal entries, newest first.

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const topicId = searchParams.get('topic_id')

  let query = supabase
    .from('civic_journal_entries')
    .select(`
      id, user_id, topic_id, content, is_public, vote_snapshot, mood,
      created_at, updated_at,
      topic:topics(id, statement, category, status, blue_pct, total_votes)
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[journal GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    entries: (data ?? []) as unknown as JournalEntry[],
    total: count ?? 0,
  } satisfies JournalResponse)
}

// ─── POST /api/journal ────────────────────────────────────────────────────────
// Creates a new journal entry for the current user.

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    content?: string
    topic_id?: string | null
    is_public?: boolean
    mood?: JournalMood | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const content = (body.content ?? '').trim()
  if (!content || content.length > 2000) {
    return NextResponse.json(
      { error: 'Content must be 1–2000 characters' },
      { status: 400 }
    )
  }

  const VALID_MOODS: JournalMood[] = ['hopeful', 'concerned', 'neutral', 'confident', 'uncertain']
  const mood: JournalMood | null =
    body.mood && VALID_MOODS.includes(body.mood) ? body.mood : null

  // Snapshot topic state at time of writing
  let vote_snapshot: { blue_pct: number; total_votes: number; status: string } | null = null
  if (body.topic_id) {
    const { data: topicRow } = await supabase
      .from('topics')
      .select('blue_pct, total_votes, status')
      .eq('id', body.topic_id)
      .single()
    if (topicRow) {
      vote_snapshot = {
        blue_pct: topicRow.blue_pct ?? 50,
        total_votes: topicRow.total_votes ?? 0,
        status: topicRow.status,
      }
    }
  }

  const { data, error } = await supabase
    .from('civic_journal_entries')
    .insert({
      user_id: user.id,
      content,
      topic_id: body.topic_id ?? null,
      is_public: body.is_public ?? false,
      mood,
      vote_snapshot,
    })
    .select(`
      id, user_id, topic_id, content, is_public, vote_snapshot, mood,
      created_at, updated_at,
      topic:topics(id, statement, category, status, blue_pct, total_votes)
    `)
    .single()

  if (error) {
    console.error('[journal POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data as unknown as JournalEntry }, { status: 201 })
}
