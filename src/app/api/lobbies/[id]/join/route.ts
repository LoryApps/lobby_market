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

  // Confirm the lobby exists and is active.
  const { data: lobby, error: lobbyError } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (lobbyError || !lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
  }

  if (!lobby.is_active) {
    return NextResponse.json(
      { error: 'Lobby is not active' },
      { status: 400 }
    )
  }

  // Guard against duplicate membership for a clear error message.
  const { data: existing } = await supabase
    .from('lobby_members')
    .select('id')
    .eq('lobby_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Already a member of this lobby' },
      { status: 409 }
    )
  }

  const { error: insertError } = await supabase.from('lobby_members').insert({
    lobby_id: params.id,
    user_id: user.id,
  })

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message ?? 'Failed to join lobby' },
      { status: 500 }
    )
  }

  // Return updated lobby so the client can reflect member_count immediately.
  const { data: updatedLobby } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  return NextResponse.json({ success: true, lobby: updatedLobby })
}
