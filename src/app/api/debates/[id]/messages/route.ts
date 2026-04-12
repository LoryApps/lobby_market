import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  DebateMessage,
  DebateMessageWithAuthor,
  Profile,
  VoteSide,
} from '@/lib/supabase/types'

const MAX_CONTENT = 500

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1),
    100
  )

  let query = supabase
    .from('debate_messages')
    .select('*')
    .eq('debate_id', params.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load messages' },
      { status: 500 }
    )
  }

  const rows = ((data ?? []) as DebateMessage[]).slice().reverse()
  const userIds = Array.from(new Set(rows.map((m) => m.user_id)))
  let profileMap = new Map<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>
  >()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p] as const))
  }

  const messages: DebateMessageWithAuthor[] = rows.map((m) => ({
    ...m,
    author: profileMap.get(m.user_id) ?? null,
  }))

  return NextResponse.json({ messages })
}

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

  let body: {
    content?: string
    side?: VoteSide | null
    is_argument?: boolean
    parent_id?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { content, side, is_argument, parent_id } = body

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const trimmed = content.trim()
  if (trimmed.length > MAX_CONTENT) {
    return NextResponse.json(
      { error: `content must be ${MAX_CONTENT} characters or fewer` },
      { status: 400 }
    )
  }

  if (side != null && side !== 'blue' && side !== 'red') {
    return NextResponse.json(
      { error: 'side must be "blue", "red", or null' },
      { status: 400 }
    )
  }

  // Verify debate is live
  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .select('id, status')
    .eq('id', params.id)
    .single()

  if (debateError || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  if (debate.status !== 'live') {
    return NextResponse.json(
      { error: 'Messages can only be sent in live debates' },
      { status: 400 }
    )
  }

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from('debate_messages')
    .insert({
      debate_id: params.id,
      user_id: user.id,
      content: trimmed,
      side: side ?? null,
      is_argument: is_argument === true,
      parent_id: parent_id ?? null,
    })
    .select('*')
    .single()

  if (insertError || !message) {
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }

  // Fetch author profile for response
  const { data: authorProfile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  const messageWithAuthor: DebateMessageWithAuthor = {
    ...(message as DebateMessage),
    author: authorProfile,
  }

  // Broadcast to realtime channel
  try {
    const channel = supabase.channel(`debate:${params.id}`)
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: messageWithAuthor,
    })
    await supabase.removeChannel(channel)
  } catch {
    // Broadcast is best-effort; don't fail the request on broadcast errors.
  }

  return NextResponse.json(messageWithAuthor, { status: 201 })
}
