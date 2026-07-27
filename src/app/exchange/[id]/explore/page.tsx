import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExchangeExploreClient } from './ExploreClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Analysis Hub · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const short = `${topic.statement.slice(0, 55)}${topic.statement.length > 55 ? '…' : ''}`
  const title = `Explore: ${short} · Lobby Exchange`
  const description =
    `Browse every analysis tool for this prediction market — price chart, ` +
    `smart money signals, debate arguments, risk analysis, and more. Current price: ${price}¢.`

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

export default async function ExchangeExplorePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <ExchangeExploreClient
      marketId={topic.id}
      statement={topic.statement}
      category={topic.category}
      status={topic.status}
      price={Math.round(topic.blue_pct ?? 50)}
      volume={topic.total_votes ?? 0}
    />
  )
}
