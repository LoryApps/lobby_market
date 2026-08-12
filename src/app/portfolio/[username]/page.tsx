import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CivicPortfolioClient } from './CivicPortfolioClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, clout, total_votes, total_arguments, civic_archetype')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Civic Portfolio · Lobby Market' }

  const name = profile.display_name ?? profile.username
  const title = `${name}'s Civic Portfolio · Lobby Market`
  const description = profile.bio
    ? `${profile.bio.slice(0, 130)} — ${profile.total_votes.toLocaleString()} votes · ${profile.total_arguments.toLocaleString()} arguments · ${profile.clout.toLocaleString()} clout`
    : `${name} on Lobby Market — ${profile.total_votes.toLocaleString()} votes cast · ${profile.total_arguments.toLocaleString()} arguments written · ${profile.clout.toLocaleString()} clout earned`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      username: profile.username,
      images: [
        {
          url: `/api/og/profile/${profile.username}`,
          width: 1200,
          height: 630,
          alt: `${name}'s civic portfolio`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/profile/${profile.username}`],
    },
    alternates: {
      canonical: `https://lobby.market/portfolio/${profile.username}`,
    },
  }
}

export default async function CivicPortfolioPage({ params }: Props) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  return <CivicPortfolioClient username={params.username} />
}
