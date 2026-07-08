import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicRelaysClient } from './TopicRelaysClient'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Relay Chains · Lobby Market' }

  const title = `Relay Chains — ${topic.statement.slice(0, 60)}${topic.statement.length > 60 ? '…' : ''} · Lobby Market`
  const description = `Browse collaborative argument relay chains built by the community on "${topic.statement}". Each relay is a team effort — join an open chain or start your own.`

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

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TopicRelaysPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <TopicRelaysClient
      topicId={topic.id}
      statement={topic.statement}
      category={topic.category ?? null}
      status={topic.status}
      bluePct={topic.blue_pct ?? 50}
    />
  )
}
