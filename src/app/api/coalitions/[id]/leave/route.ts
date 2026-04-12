import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
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

  const { data: member } = await supabase
    .from('coalition_members')
    .select('id, role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json(
      { error: 'Not a member of this coalition' },
      { status: 404 }
    )
  }

  // Leaders must hand off before leaving.
  if (member.role === 'leader') {
    return NextResponse.json(
      {
        error:
          'Leaders must transfer leadership before leaving the coalition',
      },
      { status: 400 }
    )
  }

  const { error: deleteError } = await supabase
    .from('coalition_members')
    .delete()
    .eq('id', member.id)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message ?? 'Failed to leave coalition' },
      { status: 500 }
    )
  }

  const { data: updatedCoalition } = await supabase
    .from('coalitions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  return NextResponse.json({ success: true, coalition: updatedCoalition })
}
