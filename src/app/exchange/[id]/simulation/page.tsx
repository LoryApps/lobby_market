import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SimulationClient } from './SimulationClient'

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

  if (!topic) return { title: 'Market Simulation · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt  = topic.statement ?? ''
  const title = `Simulate: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Interactive scenario simulator for this civic prediction market at ${price}¢. ` +
    `Adjust vote inflows, velocity, and debate quality to explore how the consensus price would move. ` +
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

export default async function MarketSimulationPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <SimulationClient
      id={params.id}
      statement={topic.statement}
      category={topic.category}
      status={topic.status}
      bluePct={topic.blue_pct ?? 50}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
