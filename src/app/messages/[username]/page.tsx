import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConversationClient } from './ConversationClient'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Message @${params.username} · Lobby Market`,
    robots: { index: false },
  }
}

export default async function ConversationPage({ params }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: partner } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, bio')
    .eq('username', params.username)
    .maybeSingle()

  if (!partner || partner.id === user.id) redirect('/messages')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <ConversationClient
      partner={partner as Profile}
      currentUserId={user.id}
      currentProfile={currentProfile as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>}
    />
  )
}
