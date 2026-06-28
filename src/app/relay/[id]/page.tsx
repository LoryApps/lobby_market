import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RelayDetailClient } from './RelayDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('civic_relays')
    .select('id, side, topic_id, status, vote_compelling, vote_not_compelling')
    .eq('id', params.id)
    .maybeSingle()

  if (!raw) return { title: 'Civic Relay · Lobby Market' }

  let topicStatement: string | null = null
  if (raw.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', raw.topic_id)
      .maybeSingle()
    topicStatement = topic?.statement ?? null
  }

  const sideLabel = raw.side === 'for' ? 'FOR' : 'AGAINST'
  const topic = topicStatement ? topicStatement.slice(0, 60) : 'a civic topic'
  const title = `Relay: ${sideLabel} "${topic}" · Lobby Market`

  const total = (raw.vote_compelling ?? 0) + (raw.vote_not_compelling ?? 0)
  const compPct = total > 0
    ? Math.round(((raw.vote_compelling ?? 0) / total) * 100)
    : null

  const description = [
    `A collaborative ${sideLabel} argument built by up to 5 citizens on Lobby Market.`,
    compPct !== null ? `${compPct}% found it compelling.` : null,
    raw.status === 'open' ? 'Still open — add the next leg.' : null,
  ].filter(Boolean).join(' ')

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

export default async function RelayDetailPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('civic_relays')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!raw) notFound()

  return <RelayDetailClient relayId={params.id} />
}
