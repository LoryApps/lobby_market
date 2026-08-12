import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CivicCVClient } from './CivicCVClient'

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

  if (!profile) {
    return { title: 'Civic CV · Lobby Market' }
  }

  const name = profile.display_name || profile.username
  const title = `${name}'s Civic CV · Lobby Market`
  const description = [
    `@${profile.username} on Lobby Market`,
    `${profile.clout.toLocaleString()} clout · ${profile.total_votes.toLocaleString()} votes · ${profile.total_arguments.toLocaleString()} arguments`,
    profile.bio ? profile.bio.slice(0, 120) : 'View their full civic record — laws, arguments, and achievements.',
  ].filter(Boolean).join(' · ')

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
      canonical: `https://lobby.market/cv/${profile.username}`,
    },
  }
}

export default async function CivicCVPage({ params }: Props) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  return <CivicCVClient username={params.username} />
}
