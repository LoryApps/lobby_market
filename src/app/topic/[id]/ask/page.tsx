import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AskClient } from './AskClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Community Q&A · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const short = stmt.length > 60 ? stmt.slice(0, 60) + '…' : stmt
  const title = `Ask the Community: ${short} · Lobby Market`
  const description =
    `Clarifying questions and crowd-sourced answers for this debate. ` +
    `${Math.round(topic.blue_pct ?? 50)}% FOR · ${100 - Math.round(topic.blue_pct ?? 50)}% AGAINST · ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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

export default async function AskPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <AskClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicCategory={topic.category}
      topicStatus={topic.status}
      bluePct={Math.round(topic.blue_pct ?? 50)}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
