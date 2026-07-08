import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RelayIntelligenceClient } from './RelayIntelligenceClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status, max_legs, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) return { title: 'Relay Intelligence · Lobby Market' }

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
  const title = `Relay Intel — ${side}: ${statement.slice(0, 55)}${statement.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Intelligence analysis of this collaborative ${relay.side.toUpperCase()} argument chain — leg quality scores, argument flow, contributor breakdown, and a persuasion verdict.`

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

export default async function RelayIntelligencePage({ params }: Props) {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) notFound()

  return <RelayIntelligenceClient relayId={params.id} side={relay.side} status={relay.status} />
}
