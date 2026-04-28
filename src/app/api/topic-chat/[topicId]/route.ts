import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface ChatMessage {
  id: string
  topic_id: string
  user_id: string
  content: string
  created_at: string
  author: ChatAuthor | null
}

export interface ChatResponse {
  messages: ChatMessage[]
  currentUserId: string | null
}

// ─── GET — fetch last 100 messages for a topic ────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { topicId: string } }
) {
  const { topicId } = params
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('topic_chat_messages')
      .select(
        `id, topic_id, user_id, content, created_at,
         author:profiles!topic_chat_messages_user_id_fkey(
           id, username, display_name, avatar_url, role
         )`
      )
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    const messages: ChatMessage[] = (data ?? []).map((row) => ({
      id: row.id,
      topic_id: row.topic_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      author: Array.isArray(row.author) ? (row.author[0] ?? null) : (row.author ?? null),
    }))

    return NextResponse.json({
      messages,
      currentUserId: user?.id ?? null,
    } satisfies ChatResponse)
  } catch (err) {
    console.error('[topic-chat GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── POST — send a message ────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { topicId: string } }
) {
  const { topicId } = params
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topicId' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as { content?: string }
    const content = (body.content ?? '').trim()

    if (!content) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }
    if (content.length > 300) {
      return NextResponse.json({ error: 'Message too long (max 300 chars)' }, { status: 400 })
    }

    // Rate limit: allow at most 1 message every 3 seconds per user per topic
    const cutoff = new Date(Date.now() - 3000).toISOString()
    const { count } = await supabase
      .from('topic_chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .gt('created_at', cutoff)

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Slow down — wait a moment before sending again' }, { status: 429 })
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('topic_chat_messages')
      .insert({ topic_id: topicId, user_id: user.id, content })
      .select(
        `id, topic_id, user_id, content, created_at,
         author:profiles!topic_chat_messages_user_id_fkey(
           id, username, display_name, avatar_url, role
         )`
      )
      .single()

    if (insertErr) throw insertErr

    const message: ChatMessage = {
      id: inserted.id,
      topic_id: inserted.topic_id,
      user_id: inserted.user_id,
      content: inserted.content,
      created_at: inserted.created_at,
      author: Array.isArray(inserted.author)
        ? (inserted.author[0] ?? null)
        : (inserted.author ?? null),
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error('[topic-chat POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── DELETE — remove own message ──────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { topicId: string } }
) {
  const { topicId } = params
  const { searchParams } = new URL(req.url)
  const messageId = searchParams.get('messageId')

  if (!topicId || !messageId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('topic_chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('topic_id', topicId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[topic-chat DELETE]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
