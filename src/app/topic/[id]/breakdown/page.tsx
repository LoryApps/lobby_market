import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BreakdownClient } from './BreakdownClient'

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

  if (!topic) return { title: 'Voter Breakdown · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Voter Breakdown: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `How different voter cohorts line up on "${stmt.slice(0, 80)}" — split by role tier, Clout level, engagement type, and voting timing. Currently ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
    robots: { index: false },
  }
}

export default async function BreakdownPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <BreakdownClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicCategory={topic.category}
    />
  )
}
