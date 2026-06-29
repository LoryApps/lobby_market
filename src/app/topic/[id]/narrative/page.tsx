import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NarrativeClient } from './NarrativeClient'

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

  if (!topic) return { title: 'Narrative Arc · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const statusVerbose: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Now Law',
    failed: 'Failed',
  }

  const title = `Narrative: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `The story of this civic debate — how it started, what arguments emerged, and where ${forPct}% FOR stands today across ${(topic.total_votes ?? 0).toLocaleString()} votes. ${statusVerbose[topic.status] ?? topic.status}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/topic/${params.id}`],
    },
  }
}

export default async function TopicNarrativePage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <NarrativeClient
      topicId={topic.id}
      statement={topic.statement}
      category={topic.category ?? null}
      status={topic.status}
      bluePct={topic.blue_pct ?? 50}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
