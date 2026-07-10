import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface InviteBody {
  username: string
  message?: string
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: InviteBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { username, message } = body
  if (!username?.trim()) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }
  if (message && message.length > 280) {
    return NextResponse.json({ error: 'Message too long (max 280 chars)' }, { status: 400 })
  }

  const relayId = params.id

  // Verify the relay exists and is open/in_progress
  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, status, starter_id, max_legs, topic_id')
    .eq('id', relayId)
    .maybeSingle()

  if (!relay) {
    return NextResponse.json({ error: 'Relay not found' }, { status: 404 })
  }

  if (!['open', 'in_progress'].includes(relay.status)) {
    return NextResponse.json(
      { error: 'Relay is no longer accepting legs' },
      { status: 422 }
    )
  }

  // Only the starter or a leg author may send invitations
  const { data: legCheck } = await supabase
    .from('relay_legs')
    .select('id')
    .eq('relay_id', relayId)
    .eq('author_id', user.id)
    .maybeSingle()

  const isStarter = relay.starter_id === user.id
  const isLegAuthor = !!legCheck

  if (!isStarter && !isLegAuthor) {
    return NextResponse.json(
      { error: 'Only relay participants may send invitations' },
      { status: 403 }
    )
  }

  // Resolve the invitee by username
  const { data: invitee } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', username.trim().replace(/^@/, ''))
    .maybeSingle()

  if (!invitee) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (invitee.id === user.id) {
    return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 422 })
  }

  // Check the invitee hasn't already added a leg
  const { data: existingLeg } = await supabase
    .from('relay_legs')
    .select('id')
    .eq('relay_id', relayId)
    .eq('author_id', invitee.id)
    .maybeSingle()

  if (existingLeg) {
    return NextResponse.json(
      { error: `@${invitee.username} has already contributed to this relay` },
      { status: 422 }
    )
  }

  // Insert invitation (UNIQUE constraint handles duplicate prevention)
  const { data: invitation, error: insertErr } = await supabase
    .from('relay_invitations')
    .insert({
      relay_id: relayId,
      inviter_id: user.id,
      invitee_id: invitee.id,
      message: message?.trim() || null,
    })
    .select('id, status, created_at, expires_at')
    .single()

  if (insertErr) {
    // Unique constraint violation — already invited
    if (insertErr.code === '23505') {
      return NextResponse.json(
        { error: `@${invitee.username} has already been invited to this relay` },
        { status: 409 }
      )
    }
    console.error('relay_invitations insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 })
  }

  return NextResponse.json({ invitation }, { status: 201 })
}
