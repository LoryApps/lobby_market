import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FollowListClient } from '@/components/profile/FollowListClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, following_count')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Following · Lobby Market' }

  const name = profile.display_name || profile.username
  const count = profile.following_count ?? 0
  const title = `${name} is following · Lobby Market`
  const description = `See the ${count.toLocaleString()} citizen${count === 1 ? '' : 's'} that @${profile.username} follows on Lobby Market.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function FollowingPage({ params }: Props) {
  const supabase = await createClient()

  const [profileRes, authRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, followers_count, following_count')
      .eq('username', params.username)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!profileRes.data) notFound()

  const profile = profileRes.data
  const viewer = authRes.data.user

  return (
    <FollowListClient
      username={profile.username}
      displayName={profile.display_name ?? null}
      avatarUrl={profile.avatar_url ?? null}
      followersCount={profile.followers_count ?? 0}
      followingCount={profile.following_count ?? 0}
      initialTab="following"
      viewerId={viewer?.id ?? null}
    />
  )
}
