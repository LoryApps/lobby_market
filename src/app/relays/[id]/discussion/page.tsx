import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DiscussionClient } from './DiscussionClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) return { title: 'Relay Discussion · Lobby Market' }

  let statement = 'Civic Relay'
  if (relay.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', relay.topic_id)
      .maybeSingle()
    if (topic) statement = topic.statement
  }

  const side = relay.side === 'for' ? 'FOR' : 'AGAINST'
  const title = `Discussion: ${side} relay on "${statement.slice(0, 55)}${statement.length > 55 ? '…' : ''}" · Lobby Market`
  const description = `Join the community discussion on this ${side} relay chain. Share your thoughts on the argument quality, challenge claims, and vote on whether it's compelling.`

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
    robots: { index: relay.status === 'open' ? 'noindex' : 'index' },
  }
}

export default async function RelayDiscussionPage({ params }: Props) {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status, topic_id, max_legs, vote_compelling, vote_not_compelling, completed_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) notFound()

  let topicStatement: string | null = null
  let topicCategory: string | null = null
  if (relay.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', relay.topic_id)
      .maybeSingle()
    topicStatement = topic?.statement ?? null
    topicCategory = topic?.category ?? null
  }

  return (
    <DiscussionClient
      relayId={params.id}
      side={relay.side as 'for' | 'against'}
      status={relay.status as 'open' | 'in_progress' | 'complete' | 'voted'}
      maxLegs={relay.max_legs}
      topicId={relay.topic_id}
      topicStatement={topicStatement}
      topicCategory={topicCategory}
      voteCompelling={relay.vote_compelling}
      voteNotCompelling={relay.vote_not_compelling}
      completedAt={relay.completed_at}
    />
  )
}
