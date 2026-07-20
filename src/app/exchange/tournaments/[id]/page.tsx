import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentDetailClient } from './TournamentDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('exchange_tournaments')
    .select('title, description, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) return { title: 'Tournament · Lobby Exchange' }

  const statusLabel = data.status === 'active' ? '🟢 LIVE' : data.status === 'upcoming' ? 'Upcoming' : 'Finished'

  return {
    title: `${data.title} · Lobby Exchange`,
    description: data.description ?? `${statusLabel} prediction tournament on Lobby Market Exchange.`,
    robots: { index: false },
    openGraph: {
      title: `${data.title} · Lobby Exchange`,
      description: data.description ?? 'Compete to make the most accurate civic market predictions.',
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('exchange_tournaments')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  return <TournamentDetailClient id={params.id} />
}
