import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawChatAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface LawChatMessage {
  id: string
  law_id: string
  user_id: string
  content: string
  created_at: string
  author: LawChatAuthor | null
}

export interface LawChatResponse {
  messages: LawChatMessage[]
  currentUserId: string | null
}

// ─── GET — fetch last 100 messages for a law ──────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: lawId } = params
  if (!lawId) {
    return NextResponse.json({ error: 'Missing law id' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('law_chat_messages')
      .select(
        `id, law_id, user_id, content, created_at,
         author:profiles!law_chat_messages_user_id_fkey(
           id, username, display_name, avatar_url, role
         )`
      )
      .eq('law_id', lawId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    const messages: LawChatMessage[] = (data ?? []).map((row) => ({
      id: row.id,
      law_id: row.law_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      author: Array.isArray(row.author) ? (row.author[0] ?? null) : (row.author ?? null),
    }))

    return NextResponse.json({
      messages,
      currentUserId: user?.id ?? null,
    } satisfies LawChatResponse)
  } catch (err) {
    console.error('[law-chat GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── POST — send a message ────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: lawId } = params
  if (!lawId) {
    return NextResponse.json({ error: 'Missing law id' }, { status: 400 })
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

    // Rate limit: 1 message per 3 seconds per user per law
    const cutoff = new Date(Date.now() - 3000).toISOString()
    const { count } = await supabase
      .from('law_chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('law_id', lawId)
      .eq('user_id', user.id)
      .gt('created_at', cutoff)

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Slow down — wait a moment before sending again' },
        { status: 429 }
      )
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('law_chat_messages')
      .insert({ law_id: lawId, user_id: user.id, content })
      .select(
        `id, law_id, user_id, content, created_at,
         author:profiles!law_chat_messages_user_id_fkey(
           id, username, display_name, avatar_url, role
         )`
      )
      .single()

    if (insertErr) throw insertErr

    const message: LawChatMessage = {
      id: inserted.id,
      law_id: inserted.law_id,
      user_id: inserted.user_id,
      content: inserted.content,
      created_at: inserted.created_at,
      author: Array.isArray(inserted.author)
        ? (inserted.author[0] ?? null)
        : (inserted.author ?? null),
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error('[law-chat POST]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── DELETE — remove own message ──────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: lawId } = params
  const { searchParams } = new URL(req.url)
  const messageId = searchParams.get('messageId')

  if (!lawId || !messageId) {
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
      .from('law_chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('law_id', lawId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[law-chat DELETE]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
