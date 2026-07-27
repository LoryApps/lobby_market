import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicSimulationClient } from './SimulationClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  if (!topic) return { title: 'Civic Simulator · Lobby Market' }

  const forPct  = Math.round(topic.blue_pct ?? 50)
  const stmt    = topic.statement ?? ''
  const title   = `Simulate: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Interactive vote simulator for this civic topic at ${forPct}% FOR. ` +
    `Adjust vote injections, velocity, and debate quality to explore how consensus would shift — ` +
    `and how many more votes it would take to become law. ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes currently cast.`

  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function TopicSimulationPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <TopicSimulationClient
      id={params.id}
      statement={topic.statement}
      category={topic.category}
      status={topic.status}
      bluePct={topic.blue_pct ?? 50}
      totalVotes={topic.total_votes ?? 0}
      createdAt={topic.created_at}
    />
  )
}
