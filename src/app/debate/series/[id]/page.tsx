import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DebateSeriesDetailClient } from './DebateSeriesDetailClient'

interface Props {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: series } = await supabase
    .from('debate_series')
    .select('title, description, blue_wins, red_wins, status')
    .eq('id', params.id)
    .single()

  if (!series) return { title: 'Debate Series · Lobby Market' }

  const score = `${series.blue_wins}–${series.red_wins}`
  const statusLabel = series.status === 'completed' ? 'Completed' : 'Ongoing'
  const description = series.description
    ? `${series.description} (${statusLabel}, ${score})`
    : `${statusLabel} series · Score: ${score}`

  return {
    title: `${series.title} · Lobby Market`,
    description,
    openGraph: {
      title: `${series.title} · Lobby Market`,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `${series.title} · Lobby Market`,
      description,
    },
  }
}

export default async function DebateSeriesDetailPage({ params }: Props) {
  const supabase = await createClient()

  const { data: series } = await supabase
    .from('debate_series')
    .select('id')
    .eq('id', params.id)
    .single()

  if (!series) notFound()

  return <DebateSeriesDetailClient seriesId={params.id} />
}
