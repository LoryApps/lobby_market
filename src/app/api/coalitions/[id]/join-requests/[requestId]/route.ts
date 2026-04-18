import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/coalitions/[id]/join-requests/[requestId]
// Body: { action: 'approve' | 'reject' }
// Leaders/officers only. Approving adds the user as a member.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is a leader or officer
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 }
    )
  }

  // Fetch the join request
  const { data: joinRequest } = await supabase
    .from('coalition_join_requests')
    .select('*')
    .eq('id', params.requestId)
    .eq('coalition_id', params.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!joinRequest) {
    return NextResponse.json(
      { error: 'Request not found or already resolved' },
      { status: 404 }
    )
  }

  if (action === 'approve') {
    // Check capacity
    const { data: coalition } = await supabase
      .from('coalitions')
      .select('member_count, max_members')
      .eq('id', params.id)
      .maybeSingle()

    if (coalition && coalition.member_count >= coalition.max_members) {
      return NextResponse.json({ error: 'Coalition is full' }, { status: 400 })
    }

    // Check not already a member (guard against race)
    const { data: alreadyMember } = await supabase
      .from('coalition_members')
      .select('id')
      .eq('coalition_id', params.id)
      .eq('user_id', joinRequest.user_id)
      .maybeSingle()

    if (!alreadyMember) {
      const { error: memberError } = await supabase
        .from('coalition_members')
        .insert({
          coalition_id: params.id,
          user_id: joinRequest.user_id,
          role: 'member',
        })

      if (memberError) {
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }
    }
  }

  // Update request status
  const { error: updateError } = await supabase
    .from('coalition_join_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      responded_at: new Date().toISOString(),
    })
    .eq('id', params.requestId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, action })
}
