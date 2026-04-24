import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CollectionTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  note: string | null
  added_at: string
}

export interface CollectionDetail {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  item_count: number
  created_at: string
  updated_at: string
  owner: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topics: CollectionTopic[]
  is_owner: boolean
}

// ─── GET /api/collections/[id] ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const collectionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: collection, error } = await supabase
    .from('topic_collections')
    .select('*')
    .eq('id', collectionId)
    .single()

  if (error || !collection) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Enforce visibility
  if (!collection.is_public && collection.user_id !== user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch owner profile
  const { data: owner } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', collection.user_id)
    .maybeSingle()

  // Fetch items with topic data
  const { data: items } = await supabase
    .from('collection_items')
    .select('topic_id, note, added_at')
    .eq('collection_id', collectionId)
    .order('added_at', { ascending: false })
    .limit(100)

  const topicIds = (items ?? []).map((i) => i.topic_id)
  const topicMap: Map<string, { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number; scope: string | null }> = new Map()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, scope')
      .in('id', topicIds)

    if (topics) {
      for (const t of topics) topicMap.set(t.id, t)
    }
  }

  const collectionTopics: CollectionTopic[] = (items ?? [])
    .filter((i) => topicMap.has(i.topic_id))
    .map((i) => ({
      ...(topicMap.get(i.topic_id)!),
      note: i.note ?? null,
      added_at: i.added_at,
    }))

  return NextResponse.json({
    collection: {
      ...collection,
      owner: owner ?? null,
      topics: collectionTopics,
      is_owner: collection.user_id === user?.id,
    } satisfies CollectionDetail,
  })
}

// ─── PATCH /api/collections/[id] ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; description?: string; is_public?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  type CollectionUpdatePayload = {
    updated_at: string
    name?: string
    description?: string | null
    is_public?: boolean
  }

  const updates: CollectionUpdatePayload = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'Name must be 1–80 characters' }, { status: 400 })
    }
    updates.name = name
  }
  if (body.description !== undefined) {
    const desc = body.description.trim()
    if (desc.length > 300) {
      return NextResponse.json({ error: 'Description must be ≤300 characters' }, { status: 400 })
    }
    updates.description = desc || null
  }
  if (body.is_public !== undefined) {
    updates.is_public = !!body.is_public
  }

  const { data, error } = await supabase
    .from('topic_collections')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 })
  }

  return NextResponse.json({ collection: data })
}

// ─── DELETE /api/collections/[id] ────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('topic_collections')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
