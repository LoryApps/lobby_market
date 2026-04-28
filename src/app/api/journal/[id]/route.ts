import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { JournalMood } from '../route'

export const dynamic = 'force-dynamic'

// ─── PATCH /api/journal/[id] ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    content?: string
    is_public?: boolean
    mood?: JournalMood | null
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.content === 'string') {
    const trimmed = body.content.trim()
    if (!trimmed || trimmed.length > 2000) {
      return NextResponse.json({ error: 'Content must be 1–2000 characters' }, { status: 400 })
    }
    updates.content = trimmed
  }

  if (typeof body.is_public === 'boolean') {
    updates.is_public = body.is_public
  }

  const VALID_MOODS: JournalMood[] = ['hopeful', 'concerned', 'neutral', 'confident', 'uncertain']
  if (body.mood !== undefined) {
    updates.mood = body.mood && VALID_MOODS.includes(body.mood) ? body.mood : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('civic_journal_entries')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select(`
      id, user_id, topic_id, content, is_public, vote_snapshot, mood,
      created_at, updated_at,
      topic:topics(id, statement, category, status, blue_pct, total_votes)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}

// ─── DELETE /api/journal/[id] ─────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('civic_journal_entries')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
