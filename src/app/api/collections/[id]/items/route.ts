import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST /api/collections/[id]/items — add a topic ──────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const collectionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.topic_id) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  // Verify collection ownership
  const { data: collection } = await supabase
    .from('topic_collections')
    .select('user_id, item_count')
    .eq('id', collectionId)
    .single()

  if (!collection || collection.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 })
  }

  if (collection.item_count >= 200) {
    return NextResponse.json({ error: 'Maximum 200 topics per collection' }, { status: 422 })
  }

  // Verify topic exists
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', body.topic_id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const note = body.note?.trim() ?? null
  if (note && note.length > 200) {
    return NextResponse.json({ error: 'Note must be ≤200 characters' }, { status: 400 })
  }

  const { error } = await supabase.from('collection_items').insert({
    collection_id: collectionId,
    topic_id: body.topic_id,
    note,
  })

  if (error) {
    if (error.code === '23505') {
      // Already in collection — treat as success
      return NextResponse.json({ ok: true, already_added: true })
    }
    return NextResponse.json({ error: 'Failed to add topic' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// ─── DELETE /api/collections/[id]/items — remove a topic ─────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const collectionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.topic_id) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  // Verify collection ownership
  const { data: collection } = await supabase
    .from('topic_collections')
    .select('user_id')
    .eq('id', collectionId)
    .single()

  if (!collection || collection.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 })
  }

  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('topic_id', body.topic_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to remove topic' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
