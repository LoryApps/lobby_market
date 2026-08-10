import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FollowingVotesClient } from './FollowingVotesClient'

export const dynamic = 'force-dynamic'

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

  if (!topic) return { title: 'Your Circle\'s Take · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Your Circle's Take: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Market`
  const description = `See how the people you follow voted on this topic. ${forPct}% For · ${100 - forPct}% Against across ${topic.total_votes?.toLocaleString() ?? 0} total votes.`

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

export default async function FollowingVotesPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <FollowingVotesClient
      topicId={topic.id}
      statement={topic.statement}
      category={topic.category ?? null}
      status={topic.status}
      bluePct={topic.blue_pct ?? 50}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
