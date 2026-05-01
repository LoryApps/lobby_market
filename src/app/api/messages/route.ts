import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DmConversation } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface RawMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
  sender: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  receiver: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
}

// ── GET /api/messages → inbox (conversations list) ────────────────────────────
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch recent messages involving the current user
  const { data: rows, error } = await supabase
    .from('direct_messages')
    .select(`
      id, sender_id, receiver_id, content, is_read, created_at,
      sender:profiles!direct_messages_sender_id_fkey(id, username, display_name, avatar_url, role),
      receiver:profiles!direct_messages_receiver_id_fkey(id, username, display_name, avatar_url, role)
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by conversation partner — keep only the latest message per thread
  const threadMap = new Map<string, DmConversation>()

  for (const row of (rows ?? []) as RawMessage[]) {
    const isIncoming = row.receiver_id === user.id
    const partner = isIncoming ? row.sender : row.receiver
    if (!partner) continue

    const partnerId = partner.id

    if (threadMap.has(partnerId)) {
      // Accumulate unread count for incoming unread messages
      if (isIncoming && !row.is_read) {
        const existing = threadMap.get(partnerId)!
        existing.unread_count += 1
      }
    } else {
      threadMap.set(partnerId, {
        partner,
        last_message: row.content,
        last_message_at: row.created_at,
        unread_count: isIncoming && !row.is_read ? 1 : 0,
        last_sender_id: row.sender_id,
      })
    }
  }

  const conversations: DmConversation[] = Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  )

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  return NextResponse.json({ conversations, totalUnread })
}
