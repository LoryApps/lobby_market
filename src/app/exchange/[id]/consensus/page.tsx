import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConsensusBreakdownClient } from './ConsensusBreakdownClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Consensus Breakdown · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Consensus: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Deep consensus breakdown for this civic market. Current: ${price}% FOR across ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes. See expert vs. crowd split, ` +
    `voter tier breakdown, momentum, and category context.`

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

export default async function ConsensusBreakdownPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <ConsensusBreakdownClient />
}
