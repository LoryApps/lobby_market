import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/lobbies/[id]
// Lobby detail with creator, topic header, and members list.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: lobby, error } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 })
  }

  const [{ data: creator }, { data: topic }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .eq('id', lobby.creator_id)
        .maybeSingle(),
      supabase
        .from('topics')
        .select('id, statement, category, status')
        .eq('id', lobby.topic_id)
        .maybeSingle(),
      supabase
        .from('lobby_members')
        .select('*')
        .eq('lobby_id', lobby.id)
        .order('joined_at', { ascending: true })
        .limit(200),
    ])

  // Join member profiles
  const memberIds = (memberRows ?? []).map((m) => m.user_id)
  let memberProfiles: Record<string, unknown> = {}
  if (memberIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', memberIds)
    memberProfiles = (profiles ?? []).reduce(
      (acc, p) => ({ ...acc, [p.id]: p }),
      {} as Record<string, unknown>
    )
  }

  const members = (memberRows ?? []).map((m) => ({
    ...m,
    profile: memberProfiles[m.user_id] ?? null,
  }))

  return NextResponse.json({
    lobby,
    creator: creator ?? null,
    topic: topic ?? null,
    members,
  })
}
