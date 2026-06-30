import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IntelligenceClient } from './IntelligenceClient'

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

  if (!topic) return { title: 'Intelligence Report · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Intel Report: ${topic.statement.slice(0, 55)} · Lobby Market`
  const description = `Comprehensive intelligence analysis for this debate — law probability, signal breakdown, elite vs. grassroots split, coalition intelligence, and trajectory. Currently ${forPct}% For across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function IntelligencePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <IntelligenceClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicCategory={topic.category ?? null}
      topicStatus={topic.status}
      topicForPct={topic.blue_pct ?? 50}
      topicTotalVotes={topic.total_votes ?? 0}
      topicCreatedAt={topic.created_at}
    />
  )
}
