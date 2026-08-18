import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor, ThesisStatus } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: row, error } = await supabase
    .from('civic_theses')
    .select(
      `
      id, user_id, statement, rationale, category,
      resolution_date, status, related_topic_id,
      agree_count, disagree_count, is_public, resolved_at,
      created_at, updated_at,
      profiles!civic_theses_user_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `
    )
    .eq('id', params.id)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!row.is_public && row.user_id !== user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let viewerVote: boolean | null = null
  if (user) {
    const { data: voteRow } = await supabase
      .from('thesis_votes')
      .select('agree')
      .eq('thesis_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (voteRow) viewerVote = voteRow.agree
  }

  let relatedTopicStatement: string | null = null
  if (row.related_topic_id) {
    const { data: t } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', row.related_topic_id)
      .maybeSingle()
    relatedTopicStatement = t?.statement ?? null
  }

  const authorRaw = Array.isArray(row.profiles)
    ? row.profiles[0] ?? null
    : (row.profiles as ThesisAuthor | null)

  const thesis: Thesis = {
    id: row.id,
    user_id: row.user_id,
    statement: row.statement,
    rationale: row.rationale,
    category: row.category,
    resolution_date: row.resolution_date,
    status: row.status as ThesisStatus,
    related_topic_id: row.related_topic_id,
    agree_count: row.agree_count,
    disagree_count: row.disagree_count,
    is_public: row.is_public,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: authorRaw
      ? {
          id: (authorRaw as ThesisAuthor).id,
          username: (authorRaw as ThesisAuthor).username,
          display_name: (authorRaw as ThesisAuthor).display_name,
          avatar_url: (authorRaw as ThesisAuthor).avatar_url,
          role: (authorRaw as ThesisAuthor).role,
        }
      : null,
    viewer_vote: viewerVote,
    related_topic_statement: relatedTopicStatement,
  }

  return NextResponse.json({ thesis })
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('civic_theses')
    .select('user_id')
    .eq('id', params.id)
    .single()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { status?: string; resolution_date?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (body.status) {
    const valid: ThesisStatus[] = ['active', 'vindicated', 'refuted', 'expired']
    if (!valid.includes(body.status as ThesisStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
    if (body.status !== 'active') {
      updates.resolved_at = new Date().toISOString()
    }
  }

  if (body.resolution_date !== undefined) {
    updates.resolution_date = body.resolution_date || null
  }

  const { data, error } = await supabase
    .from('civic_theses')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ thesis: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('civic_theses')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
