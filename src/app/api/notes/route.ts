import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CivicNote {
  id: string
  user_id: string
  topic_id: string | null
  title: string
  content: string
  pinned: boolean
  created_at: string
  updated_at: string
  topic: { id: string; statement: string; category: string | null; status: string } | null
}

export interface NotesResponse {
  notes: CivicNote[]
}

// GET /api/notes?q=search&topic_id=xxx
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const topicId = searchParams.get('topic_id')

  let query = supabase
    .from('civic_notes')
    .select(`
      id, user_id, topic_id, title, content, pinned, created_at, updated_at,
      topic:topics ( id, statement, category, status )
    `)
    .eq('user_id', user.id)

  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  if (q) {
    // Use ILIKE search across title and content
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
  }

  // Pinned first, then by updated_at desc
  query = query.order('pinned', { ascending: false }).order('updated_at', { ascending: false })

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notes: (data ?? []) as CivicNote[] })
}

// POST /api/notes — create a note
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    title?: string
    content?: string
    topic_id?: string | null
    pinned?: boolean
  }

  const title = (body.title ?? '').slice(0, 200).trim()
  const content = (body.content ?? '').slice(0, 10000).trim()

  if (!title && !content) {
    return NextResponse.json({ error: 'Note cannot be empty' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('civic_notes')
    .insert({
      user_id: user.id,
      title,
      content,
      topic_id: body.topic_id ?? null,
      pinned: body.pinned ?? false,
    })
    .select(`
      id, user_id, topic_id, title, content, pinned, created_at, updated_at,
      topic:topics ( id, statement, category, status )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data as CivicNote }, { status: 201 })
}

// PATCH /api/notes — update a note
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    id: string
    title?: string
    content?: string
    topic_id?: string | null
    pinned?: boolean
  }

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title.slice(0, 200).trim()
  if (body.content !== undefined) updates.content = body.content.slice(0, 10000).trim()
  if (body.topic_id !== undefined) updates.topic_id = body.topic_id
  if (body.pinned !== undefined) updates.pinned = body.pinned

  const { data, error } = await supabase
    .from('civic_notes')
    .update(updates)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .select(`
      id, user_id, topic_id, title, content, pinned, created_at, updated_at,
      topic:topics ( id, statement, category, status )
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data as CivicNote })
}

// DELETE /api/notes?id=xxx
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('civic_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
