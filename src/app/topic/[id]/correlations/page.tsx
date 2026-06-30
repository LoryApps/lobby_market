import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CorrelationsClient } from './CorrelationsClient'

interface Props {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Correlations · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Ideological Correlations: ${topic.statement.slice(0, 55)} · Lobby Market`
  const description = `Discover which other debates share voters with this one — and whether they vote the same way. ${forPct}% For · ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function TopicCorrelationsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <CorrelationsClient
      topicId={params.id}
      topicStatement={topic.statement}
      topicCategory={topic.category}
      topicBluePct={topic.blue_pct ?? 50}
      topicTotalVotes={topic.total_votes ?? 0}
    />
  )
}
