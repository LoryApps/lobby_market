import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LobbyDetail } from '@/components/lobby/LobbyDetail'
import type { Lobby, Profile, Topic } from '@/lib/supabase/types'

interface LobbyPageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export default async function LobbyPage({ params }: LobbyPageProps) {
  const supabase = await createClient()

  const { data: lobby, error } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !lobby) {
    notFound()
  }

  const typedLobby = lobby as Lobby

  const [
    { data: creator },
    { data: topic },
    { data: memberRows },
    { data: authData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', typedLobby.creator_id)
      .maybeSingle(),
    supabase
      .from('topics')
      .select('id, statement, category')
      .eq('id', typedLobby.topic_id)
      .maybeSingle(),
    supabase
      .from('lobby_members')
      .select('*')
      .eq('lobby_id', typedLobby.id)
      .order('joined_at', { ascending: true })
      .limit(200),
    supabase.auth.getUser(),
  ])

  const memberIds = (memberRows ?? []).map((m) => m.user_id)
  const { data: memberProfiles } = memberIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', memberIds)
    : { data: [] as Profile[] }

  const profileMap = new Map<string, Profile>()
  for (const p of memberProfiles ?? []) {
    profileMap.set(p.id, p as Profile)
  }

  const members = (memberRows ?? []).map((m) => ({
    id: m.id,
    lobby_id: m.lobby_id,
    user_id: m.user_id,
    joined_at: m.joined_at,
    profile: profileMap.get(m.user_id) ?? null,
  }))

  const viewerId = authData?.user?.id ?? null
  const viewerIsMember = viewerId
    ? members.some((m) => m.user_id === viewerId)
    : false

  return (
    <LobbyDetail
      lobby={typedLobby}
      creator={creator ?? null}
      topic={
        (topic as Pick<Topic, 'id' | 'statement' | 'category'> | null) ?? null
      }
      members={members}
      viewerId={viewerId}
      viewerIsMember={viewerIsMember}
    />
  )
}
