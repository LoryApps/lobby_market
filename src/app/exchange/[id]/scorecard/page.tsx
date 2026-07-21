import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScorecardClient } from './ScorecardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  if (!topic) return { title: 'Market Scorecard · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Scorecard: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Exchange`
  const description =
    `Full market scorecard for "${stmt.slice(0, 80)}" — consensus grade, ` +
    `momentum, argument quality, and engagement rating. Currently at ${price}¢ ` +
    `with ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function MarketScorecardPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, feed_score, view_count')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <ScorecardClient
      topicId={topic.id}
      statement={topic.statement ?? ''}
      category={topic.category}
      status={topic.status}
      price={Math.round(topic.blue_pct ?? 50)}
      totalVotes={topic.total_votes ?? 0}
      blueVotes={topic.blue_votes ?? 0}
      redVotes={topic.red_votes ?? 0}
      feedScore={topic.feed_score ?? 0}
      viewCount={topic.view_count ?? 0}
    />
  )
}
