import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ArgumentDraftWithTopic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// GET /api/arguments/drafts — list the authenticated user's drafts
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('argument_drafts')
    .select(`
      id,
      user_id,
      topic_id,
      side,
      content,
      created_at,
      updated_at,
      topic:topics ( id, statement, category, status )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ drafts: data as ArgumentDraftWithTopic[] })
}

// PUT /api/arguments/drafts — upsert a draft (create or update)
export async function PUT(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { topic_id, side, content } = body as {
    topic_id?: string
    side?: string
    content?: string
  }

  if (!topic_id || !side || !content) {
    return NextResponse.json({ error: 'topic_id, side, and content are required' }, { status: 400 })
  }

  if (!['blue', 'red'].includes(side)) {
    return NextResponse.json({ error: 'side must be blue or red' }, { status: 400 })
  }

  if (content.trim().length < 10) {
    return NextResponse.json({ error: 'Draft must be at least 10 characters' }, { status: 400 })
  }

  if (content.length > 500) {
    return NextResponse.json({ error: 'Draft exceeds 500 character limit' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('argument_drafts')
    .upsert(
      { user_id: user.id, topic_id, side, content: content.trim() },
      { onConflict: 'user_id,topic_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ draft: data })
}
