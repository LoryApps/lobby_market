import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevisionEntry {
  id: string
  law_id: string
  revision_num: number
  body_markdown: string
  summary: string | null
  char_delta: number | null
  created_at: string
  editor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface RevisionsResponse {
  revisions: RevisionEntry[]
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    body_markdown: string | null
  } | null
  total: number
}

// GET /api/laws/[id]/revisions — list all revisions, newest first
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const [lawRes, revisionsRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, established_at, body_markdown')
      .eq('id', params.id)
      .single(),
    supabase
      .from('law_revisions')
      .select('id, law_id, revision_num, body_markdown, summary, created_at, editor_id')
      .eq('law_id', params.id)
      .order('revision_num', { ascending: false }),
  ])

  if (lawRes.error || !lawRes.data) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const rawRevisions = (revisionsRes.data ?? []) as Array<{
    id: string
    law_id: string
    revision_num: number
    body_markdown: string
    summary: string | null
    created_at: string
    editor_id: string
  }>

  // Batch-fetch editor profiles
  const editorIds = [...new Set(rawRevisions.map((r) => r.editor_id).filter(Boolean))]
  const { data: profiles } = editorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', editorIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  // Compute char deltas (diff between consecutive revisions)
  const orderedAsc = [...rawRevisions].reverse()
  const revisionsWithDelta: RevisionEntry[] = rawRevisions.map((rev) => {
    const prevIdx = orderedAsc.findIndex((r) => r.revision_num === rev.revision_num) - 1
    const prevBody = prevIdx >= 0 ? orderedAsc[prevIdx].body_markdown : (lawRes.data.body_markdown ?? '')
    const charDelta = rev.body_markdown.length - (prevBody?.length ?? 0)
    return {
      id: rev.id,
      law_id: rev.law_id,
      revision_num: rev.revision_num,
      body_markdown: rev.body_markdown,
      summary: rev.summary,
      char_delta: charDelta,
      created_at: rev.created_at,
      editor: rev.editor_id ? (profileMap[rev.editor_id] ?? null) : null,
    }
  })

  return NextResponse.json({
    revisions: revisionsWithDelta,
    law: lawRes.data,
    total: revisionsWithDelta.length,
  } satisfies RevisionsResponse)
}

// POST /api/laws/[id]/revisions
// Propose a new wiki-style revision to an established Law's body text.
// Requires: authenticated user.
// Body: { body_markdown: string, summary?: string }
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { body_markdown?: string; summary?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const bodyMarkdown = body.body_markdown?.trim() ?? ''
  const summary = body.summary?.trim() ?? null

  if (bodyMarkdown.length < 50) {
    return NextResponse.json(
      { error: 'Revision body must be at least 50 characters' },
      { status: 400 }
    )
  }

  if (bodyMarkdown.length > 50000) {
    return NextResponse.json(
      { error: 'Revision body must be under 50,000 characters' },
      { status: 400 }
    )
  }

  // Verify the law exists and is active
  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, is_active')
    .eq('id', params.id)
    .single()

  if (lawError || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  if (!law.is_active) {
    return NextResponse.json(
      { error: 'This law is no longer active' },
      { status: 409 }
    )
  }

  // Get the next revision number
  const { data: lastRevision } = await supabase
    .from('law_revisions')
    .select('revision_num')
    .eq('law_id', params.id)
    .order('revision_num', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextRevNum = (lastRevision?.revision_num ?? 0) + 1

  // Insert the new revision
  const { data: revision, error: insertError } = await supabase
    .from('law_revisions')
    .insert({
      law_id: params.id,
      editor_id: user.id,
      body_markdown: bodyMarkdown,
      summary,
      revision_num: nextRevNum,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, revision }, { status: 201 })
}
