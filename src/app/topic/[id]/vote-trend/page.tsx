import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VoteTrendClient } from './VoteTrendClient'

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

  if (!topic) return { title: 'Vote Trend · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Consensus Trend: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Watch how public consensus has shifted over time — currently ${forPct}% FOR ` +
    `across ${(topic.total_votes ?? 0).toLocaleString()} votes. ` +
    `Track every momentum shift, tipping-point day, and opinion reversal in this debate.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
    robots: { index: false },
  }
}

export default async function VoteTrendPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <VoteTrendClient
      topicId={params.id}
      statement={topic.statement ?? ''}
      category={topic.category ?? null}
      status={topic.status ?? 'proposed'}
      currentForPct={Math.round((topic.blue_pct ?? 50) * 10) / 10}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
