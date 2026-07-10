import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  req: Request,
  { params }: { params: { inviteId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action: 'accept' | 'decline' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!['accept', 'decline'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 })
  }

  const { data: invite } = await supabase
    .from('relay_invitations')
    .select('id, relay_id, invitee_id, status, expires_at')
    .eq('id', params.inviteId)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  if (invite.invitee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (invite.status !== 'pending') {
    return NextResponse.json(
      { error: `Invitation is already ${invite.status}` },
      { status: 409 }
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from('relay_invitations')
      .update({ status: 'expired' })
      .eq('id', invite.id)
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
  }

  const newStatus = body.action === 'accept' ? 'accepted' : 'declined'

  const { data: updated, error: updateErr } = await supabase
    .from('relay_invitations')
    .update({ status: newStatus, responded_at: new Date().toISOString() })
    .eq('id', invite.id)
    .select('id, relay_id, status')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 })
  }

  return NextResponse.json({ invitation: updated })
}
