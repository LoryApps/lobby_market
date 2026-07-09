import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TranscriptClient } from './TranscriptClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status, topic_id, completed_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) return { title: 'Relay Transcript · Lobby Market' }

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
  const title = `${side}: ${statement.slice(0, 60)}${statement.length > 60 ? '…' : ''} — Relay Transcript · Lobby Market`
  const description =
    `Collaborative civic position paper — ${side} argument chain for "${statement.slice(0, 80)}". ` +
    `Read how the community built a collective case through connected argument legs.`

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

export default async function RelayTranscriptPage({ params }: Props) {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) notFound()

  return <TranscriptClient relayId={params.id} initialSide={relay.side} />
}
