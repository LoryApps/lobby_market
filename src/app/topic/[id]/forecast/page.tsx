import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ForecastClient } from './ForecastClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Law Forecast · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Law Forecast: ${topic.statement.slice(0, 55)} · Lobby Market`
  const description = `Statistical probability forecast for this topic becoming law — currently ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes. Signals, category base rate, and historical comparables.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function ForecastPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <ForecastClient topicId={params.id} />
}
