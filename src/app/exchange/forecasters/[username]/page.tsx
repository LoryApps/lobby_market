import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ForecasterProfileClient } from './ForecasterProfileClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { username: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, bio')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return { title: 'Forecaster · Lobby Exchange' }
  }

  const name = profile.display_name ?? profile.username
  const title = `${name} — Civic Forecaster · Lobby Exchange`
  const description =
    profile.bio
      ? `${profile.bio.slice(0, 120)}${profile.bio.length > 120 ? '…' : ''} · View ${name}'s full civic prediction track record on Lobby Exchange.`
      : `View ${name}'s civic prediction track record — accuracy, direction hit rate, and all market forecasts on Lobby Exchange.`

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
    robots: { index: true, follow: true },
  }
}

export default async function ForecasterProfilePage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  return <ForecasterProfileClient username={params.username} />
}
