import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
