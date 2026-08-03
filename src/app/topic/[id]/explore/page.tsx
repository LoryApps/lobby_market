import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExploreClient } from './ExploreClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Analysis Hub · Lobby Market' }

  const short = `${topic.statement.slice(0, 55)}${topic.statement.length > 55 ? '…' : ''}`
  const title = `Explore: ${short} · Lobby Market`
  const description =
    `Browse all 90+ analysis tools for this topic — voting breakdown, argument graph, ` +
    `AI brief, forecasts, community insights, advanced analytics, and more.`

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

export default async function ExplorePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <ExploreClient
      topicId={topic.id}
      statement={topic.statement}
      category={topic.category}
      status={topic.status}
      bluePct={topic.blue_pct ?? 50}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
