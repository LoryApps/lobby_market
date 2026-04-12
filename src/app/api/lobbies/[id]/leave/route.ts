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
    .from('lobby_members')
    .select('id')
    .eq('lobby_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json(
      { error: 'Not a member of this lobby' },
      { status: 404 }
    )
  }

  const { error: deleteError } = await supabase
    .from('lobby_members')
    .delete()
    .eq('id', member.id)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message ?? 'Failed to leave lobby' },
      { status: 500 }
    )
  }

  const { data: updatedLobby } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  return NextResponse.json({ success: true, lobby: updatedLobby })
}
