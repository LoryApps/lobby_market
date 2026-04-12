import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/coalition-invites/[inviteId]/respond
// Body: { action: 'accept' | 'decline' }
export async function POST(
  request: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action as 'accept' | 'decline' | undefined

  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json(
      { error: 'action must be "accept" or "decline"' },
      { status: 400 }
    )
  }

  // Fetch invite and verify ownership
  const { data: invite, error: fetchError } = await supabase
    .from('coalition_invites')
    .select('*')
    .eq('id', params.inviteId)
    .eq('invitee_id', user.id)
    .maybeSingle()

  if (fetchError || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.status !== 'pending') {
    return NextResponse.json(
      { error: 'Invite has already been responded to' },
      { status: 409 }
    )
  }

  // Update invite status
  const { error: updateError } = await supabase
    .from('coalition_invites')
    .update({
      status: action === 'accept' ? 'accepted' : 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('id', params.inviteId)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? 'Failed to respond to invite' },
      { status: 500 }
    )
  }

  if (action === 'accept') {
    // Verify coalition is not full
    const { data: coalition } = await supabase
      .from('coalitions')
      .select('member_count, max_members')
      .eq('id', invite.coalition_id)
      .maybeSingle()

    if (!coalition) {
      return NextResponse.json(
        { error: 'Coalition no longer exists' },
        { status: 404 }
      )
    }

    if (coalition.member_count >= coalition.max_members) {
      // Revert invite status so the user knows why
      await supabase
        .from('coalition_invites')
        .update({ status: 'pending', responded_at: null })
        .eq('id', params.inviteId)

      return NextResponse.json(
        { error: 'Coalition is full — cannot join right now' },
        { status: 400 }
      )
    }

    // Add as member
    const { error: memberError } = await supabase
      .from('coalition_members')
      .insert({
        coalition_id: invite.coalition_id,
        user_id: user.id,
        role: 'member',
      })

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message ?? 'Failed to join coalition' },
        { status: 500 }
      )
    }

    // Notify the inviter
    await supabase.from('notifications').insert({
      user_id: invite.inviter_id,
      type: 'coalition_invite_accepted',
      title: 'Invite accepted',
      body: 'Your coalition invite was accepted',
      reference_id: invite.coalition_id,
      reference_type: 'coalition',
      is_read: false,
    })
  }

  return NextResponse.json({ success: true })
}
