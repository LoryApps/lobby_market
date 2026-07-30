import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 40
const MAX_CONTENT = 300

export interface ChatMessage {
  id: string
  law_id: string
  user_id: string
  content: string
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
}

export interface ChatResponse {
  messages: ChatMessage[]
  total: number
}

// ── GET /api/law-chat/[lawId] ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { lawId: string } }
) {
  const supabase = await createClient()

  const { data, error, count } = await supabase
    .from('law_chat_messages')
    .select(
      `id, law_id, user_id, content, created_at,
       author:profiles!law_chat_messages_user_id_fkey(username, display_name, avatar_url, role, clout)`,
      { count: 'exact' }
    )
    .eq('law_id', params.lawId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const messages: ChatMessage[] = (data ?? []).map((row: Record<string, unknown>) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author
    return {
      id: row.id as string,
      law_id: row.law_id as string,
      user_id: row.user_id as string,
      content: row.content as string,
      created_at: row.created_at as string,
      author: {
        username: (author as Record<string, unknown>)?.username as string ?? 'unknown',
        display_name: (author as Record<string, unknown>)?.display_name as string | null ?? null,
        avatar_url: (author as Record<string, unknown>)?.avatar_url as string | null ?? null,
        role: (author as Record<string, unknown>)?.role as string ?? 'person',
        clout: (author as Record<string, unknown>)?.clout as number ?? 0,
      },
    }
  })

  // Return in ascending order for display (oldest first)
  return NextResponse.json({ messages: messages.reverse(), total: count ?? 0 } satisfies ChatResponse)
}

// ── POST /api/law-chat/[lawId] ────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { lawId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const content: string = (body.content ?? '').trim()

  if (!content || content.length > MAX_CONTENT) {
    return NextResponse.json({ error: 'Invalid content length' }, { status: 400 })
  }

  // Verify the law exists
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('law_chat_messages')
    .insert({ law_id: params.lawId, user_id: user.id, content })
    .select(
      `id, law_id, user_id, content, created_at,
       author:profiles!law_chat_messages_user_id_fkey(username, display_name, avatar_url, role, clout)`
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const author = Array.isArray(data.author) ? data.author[0] : data.author
  const message: ChatMessage = {
    id: data.id,
    law_id: data.law_id,
    user_id: data.user_id,
    content: data.content,
    created_at: data.created_at,
    author: {
      username: (author as Record<string, unknown>)?.username as string ?? 'unknown',
      display_name: (author as Record<string, unknown>)?.display_name as string | null ?? null,
      avatar_url: (author as Record<string, unknown>)?.avatar_url as string | null ?? null,
      role: (author as Record<string, unknown>)?.role as string ?? 'person',
      clout: (author as Record<string, unknown>)?.clout as number ?? 0,
    },
  }

  return NextResponse.json(message, { status: 201 })
}

// ── DELETE /api/law-chat/[lawId] ──────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { lawId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const messageId = searchParams.get('id')

  if (!messageId) {
    return NextResponse.json({ error: 'Missing message id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('law_chat_messages')
    .delete()
    .eq('id', messageId)
    .eq('law_id', params.lawId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
