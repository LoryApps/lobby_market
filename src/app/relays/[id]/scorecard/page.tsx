import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RelayScorecardClient } from './RelayScorecardClient'

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

  if (!relay) return { title: 'Relay Scorecard · Lobby Market' }

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
  const title = `Scorecard — ${side}: ${statement.slice(0, 55)}${statement.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Per-leg star breakdown, compelling vote score, and head-to-head comparison for this collaborative ${relay.side.toUpperCase()} argument chain.`

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

export default async function RelayScorecardPage({ params }: Props) {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) notFound()

  return <RelayScorecardClient />
}
