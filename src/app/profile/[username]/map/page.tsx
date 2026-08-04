import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileMapClient } from './ProfileMapClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, total_votes, blue_vote_count, red_vote_count')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return { title: 'Civic Map · Lobby Market' }
  }

  const name = profile.display_name ?? params.username
  const forCount = profile.blue_vote_count ?? 0
  const againstCount = profile.red_vote_count ?? 0
  const total = profile.total_votes ?? 0

  const description =
    total > 0
      ? `${name}'s civic map — ${forCount} FOR, ${againstCount} AGAINST across ${total} votes. Explore their positions clustered by topic category.`
      : `${name} hasn't cast any votes yet. Check back soon.`

  return {
    title: `${name}'s Civic Map · Lobby Market`,
    description,
    openGraph: {
      title: `${name}'s Civic Map · Lobby Market`,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name}'s Civic Map · Lobby Market`,
      description,
    },
  }
}

export default async function ProfileMapPage({ params }: Props) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    notFound()
  }

  return <ProfileMapClient username={params.username} />
}
