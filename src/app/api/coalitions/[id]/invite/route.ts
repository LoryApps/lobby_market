import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/coalitions/[id]/invite
// Body: { username: string, message?: string }
// Leader-only: invite a user to join the coalition
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

  // Verify caller is a leader or officer
  const { data: callerMember } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!callerMember || !['leader', 'officer'].includes(callerMember.role)) {
    return NextResponse.json(
      { error: 'Only leaders and officers can invite members' },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const username = (body.username ?? '').trim().replace(/^@/, '')
  const message = (body.message ?? '').trim() || null

  if (!username) {
    return NextResponse.json(
      { error: 'username is required' },
      { status: 400 }
    )
  }

  // Look up the invitee
  const { data: invitee } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', username)
    .maybeSingle()

  if (!invitee) {
    return NextResponse.json(
      { error: `User "@${username}" not found` },
      { status: 404 }
    )
  }

  if (invitee.id === user.id) {
    return NextResponse.json(
      { error: 'You cannot invite yourself' },
      { status: 400 }
    )
  }

  // Check coalition capacity
  const { data: coalition } = await supabase
    .from('coalitions')
    .select('member_count, max_members')
    .eq('id', params.id)
    .maybeSingle()

  if (!coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  if (coalition.member_count >= coalition.max_members) {
    return NextResponse.json(
      { error: 'Coalition is at maximum capacity' },
      { status: 400 }
    )
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from('coalition_members')
    .select('id')
    .eq('coalition_id', params.id)
    .eq('user_id', invitee.id)
    .maybeSingle()

  if (existingMember) {
    return NextResponse.json(
      { error: `@${username} is already a member` },
      { status: 409 }
    )
  }

  // Upsert invite (replace a previously declined invite)
  const { data: invite, error: inviteError } = await supabase
    .from('coalition_invites')
    .upsert(
      {
        coalition_id: params.id,
        inviter_id: user.id,
        invitee_id: invitee.id,
        status: 'pending',
        message,
        responded_at: null,
      },
      { onConflict: 'coalition_id,invitee_id' }
    )
    .select()
    .single()

  if (inviteError) {
    return NextResponse.json(
      { error: inviteError.message ?? 'Failed to send invite' },
      { status: 500 }
    )
  }

  // Create notification for invitee
  await supabase.from('notifications').insert({
    user_id: invitee.id,
    type: 'coalition_invite',
    title: 'Coalition invitation',
    body: `You've been invited to join a coalition`,
    reference_id: params.id,
    reference_type: 'coalition',
    is_read: false,
  })

  return NextResponse.json({ success: true, invite })
}

// GET /api/coalitions/[id]/invite
// Returns pending invites for the coalition (leader/officer only)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: callerMember } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!callerMember || !['leader', 'officer'].includes(callerMember.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: invites } = await supabase
    .from('coalition_invites')
    .select('*')
    .eq('coalition_id', params.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Get invitee profiles
  const inviteeIds = (invites ?? []).map((i) => i.invitee_id)
  const { data: profiles } = inviteeIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', inviteeIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const enriched = (invites ?? []).map((inv) => ({
    ...inv,
    invitee: profileMap.get(inv.invitee_id) ?? null,
  }))

  return NextResponse.json({ invites: enriched })
}
