import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_SOURCES = 5

export interface TopicSource {
  id: string
  topic_id: string
  added_by: string
  url: string
  title: string
  description: string | null
  domain: string | null
  display_order: number
  created_at: string
  added_by_profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

// GET /api/topics/[id]/sources
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topic_sources')
    .select(`
      *,
      added_by_profile:profiles!topic_sources_added_by_fkey(
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('topic_id', params.id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load sources' }, { status: 500 })
  }

  return NextResponse.json({ sources: data ?? [] })
}

// POST /api/topics/[id]/sources
export async function POST(
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

  // Verify the user is the topic author or a moderator
  const { data: topic } = await supabase
    .from('topics')
    .select('author_id')
    .eq('id', params.id)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isMod =
    profile?.role === 'troll_catcher' || profile?.role === 'elder'
  const isAuthor = topic.author_id === user.id

  if (!isAuthor && !isMod) {
    return NextResponse.json(
      { error: 'Only the topic author or a moderator can add sources' },
      { status: 403 }
    )
  }

  // Enforce max 5 sources
  const { count } = await supabase
    .from('topic_sources')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)

  if ((count ?? 0) >= MAX_SOURCES) {
    return NextResponse.json(
      { error: `Topics can have at most ${MAX_SOURCES} pinned sources` },
      { status: 422 }
    )
  }

  const body = (await request.json()) as {
    url?: string
    title?: string
    description?: string
  }

  const url = (body.url ?? '').trim()
  const title = (body.title ?? '').trim()
  const description = (body.description ?? '').trim() || null

  if (!url || !title) {
    return NextResponse.json({ error: 'url and title are required' }, { status: 400 })
  }

  // Basic URL validation
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (title.length > 200) {
    return NextResponse.json({ error: 'Title must be 200 chars or less' }, { status: 400 })
  }

  const nextOrder = count ?? 0

  const { data: source, error: insertError } = await supabase
    .from('topic_sources')
    .insert({
      topic_id: params.id,
      added_by: user.id,
      url,
      title,
      description,
      display_order: nextOrder,
    })
    .select(`
      *,
      added_by_profile:profiles!topic_sources_added_by_fkey(
        username,
        display_name,
        avatar_url
      )
    `)
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'That URL is already pinned to this topic' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to add source' }, { status: 500 })
  }

  return NextResponse.json({ source }, { status: 201 })
}

// DELETE /api/topics/[id]/sources?sourceId=<uuid>
export async function DELETE(
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

  const { searchParams } = new URL(request.url)
  const sourceId = searchParams.get('sourceId')

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
  }

  // Topic author, source adder, or moderator can delete
  const { data: source } = await supabase
    .from('topic_sources')
    .select('added_by, topic_id')
    .eq('id', sourceId)
    .eq('topic_id', params.id)
    .single()

  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('author_id')
    .eq('id', params.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const canDelete =
    source.added_by === user.id ||
    topic?.author_id === user.id ||
    profile?.role === 'troll_catcher' ||
    profile?.role === 'elder'

  if (!canDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('topic_sources')
    .delete()
    .eq('id', sourceId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
