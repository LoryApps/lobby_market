import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { RelayDetailClient } from './RelayDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status, max_legs, topic_id, starter_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) {
    return { title: 'Relay · Lobby Market' }
  }

  // Fetch topic + leg count
  const [topicResult, legResult] = await Promise.all([
    relay.topic_id
      ? supabase
          .from('topics')
          .select('statement, category')
          .eq('id', relay.topic_id)
          .maybeSingle()
      : { data: null },
    supabase
      .from('relay_legs')
      .select('id', { count: 'exact' })
      .eq('relay_id', params.id),
  ])

  const topic = topicResult.data
  const legCount = legResult.count ?? 0
  const side = relay.side === 'for' ? 'FOR' : 'AGAINST'

  const title = topic
    ? `${side} Relay: ${topic.statement.slice(0, 60)}${topic.statement.length > 60 ? '…' : ''} · Lobby Market`
    : `Civic Relay · Lobby Market`

  const description = topic
    ? `A collaborative ${side} argument for "${topic.statement.slice(0, 80)}". ${legCount}/${relay.max_legs} legs contributed. Join the chain on Lobby Market.`
    : `A collaborative ${side} civic argument chain — ${legCount}/${relay.max_legs} legs contributed.`

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

export default function RelayPage() {
  return <RelayDetailClient />
}
