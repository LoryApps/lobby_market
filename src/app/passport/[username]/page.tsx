import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PassportClient } from './PassportClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, clout, total_votes, civic_archetype')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return { title: 'Civic Passport · Lobby Market' }
  }

  const name = profile.display_name || profile.username
  const title = `${name}'s Civic Passport · Lobby Market`
  const description = `Official civic passport for @${profile.username} — ${profile.clout.toLocaleString()} clout, ${profile.total_votes.toLocaleString()} votes cast. View their full civic record on Lobby Market.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      username: profile.username,
      images: [{ url: `/api/og/profile/${profile.username}`, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/profile/${profile.username}`],
    },
    alternates: {
      canonical: `https://lobby.market/passport/${profile.username}`,
    },
  }
}

export default async function PassportPage({ params }: Props) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  return <PassportClient username={params.username} />
}
