import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/coalitions/[id]/members/[userId]
// Leader/officer only: remove a member from the coalition
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.id === params.userId) {
    return NextResponse.json(
      { error: 'Use the leave endpoint to remove yourself' },
      { status: 400 }
    )
  }

  // Verify caller is leader or officer
  const { data: callerMember } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!callerMember || !['leader', 'officer'].includes(callerMember.role)) {
    return NextResponse.json(
      { error: 'Only leaders and officers can remove members' },
      { status: 403 }
    )
  }

  // Get the target member
  const { data: targetMember } = await supabase
    .from('coalition_members')
    .select('id, role')
    .eq('coalition_id', params.id)
    .eq('user_id', params.userId)
    .maybeSingle()

  if (!targetMember) {
    return NextResponse.json(
      { error: 'Member not found in this coalition' },
      { status: 404 }
    )
  }

  // Officers cannot kick other officers or leaders
  if (
    callerMember.role === 'officer' &&
    ['leader', 'officer'].includes(targetMember.role)
  ) {
    return NextResponse.json(
      { error: 'Officers can only remove regular members' },
      { status: 403 }
    )
  }

  // Leaders cannot kick themselves (use leave instead)
  if (targetMember.role === 'leader') {
    return NextResponse.json(
      { error: 'Cannot remove the coalition leader' },
      { status: 400 }
    )
  }

  const { error: deleteError } = await supabase
    .from('coalition_members')
    .delete()
    .eq('id', targetMember.id)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message ?? 'Failed to remove member' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
