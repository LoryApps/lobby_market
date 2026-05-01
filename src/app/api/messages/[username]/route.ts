import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RawMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
  sender: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
}

// ── GET /api/messages/[username] → conversation thread ────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve partner by username
  const { data: partner } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, bio')
    .eq('username', params.username)
    .maybeSingle()

  if (!partner) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (partner.id === user.id) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })

  // Fetch thread
  const { data: rows, error } = await supabase
    .from('direct_messages')
    .select(`
      id, sender_id, receiver_id, content, is_read, created_at,
      sender:profiles!direct_messages_sender_id_fkey(id, username, display_name, avatar_url, role)
    `)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const messages = (rows ?? []) as RawMessage[]

  // Mark incoming unread messages as read
  const unreadIds = messages
    .filter((m) => m.receiver_id === user.id && !m.is_read)
    .map((m) => m.id)

  if (unreadIds.length > 0) {
    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .in('id', unreadIds)
  }

  return NextResponse.json({ messages, partner })
}

// ── POST /api/messages/[username] → send a message ────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let content: string
  try {
    const body = await req.json()
    content = (body.content ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!content || content.length > 1000) {
    return NextResponse.json({ error: 'Message must be 1–1000 characters' }, { status: 422 })
  }

  // Resolve partner
  const { data: partner } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', params.username)
    .maybeSingle()

  if (!partner) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (partner.id === user.id) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })

  const { data: message, error } = await supabase
    .from('direct_messages')
    .insert({ sender_id: user.id, receiver_id: partner.id, content })
    .select(`
      id, sender_id, receiver_id, content, is_read, created_at,
      sender:profiles!direct_messages_sender_id_fkey(id, username, display_name, avatar_url, role)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message })
}
