import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketConvictionClient } from './MarketConvictionClient'

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

  if (!topic) return { title: 'Conviction Atlas · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Conviction: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Exchange`
  const description =
    `How deeply do traders believe in their positions on this civic market? ` +
    `Conviction scores, persuadability analysis, and argument weight distribution. ` +
    `Currently at ${price}¢ with ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function MarketConvictionPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <MarketConvictionClient
      id={topic.id}
      statement={topic.statement ?? ''}
      category={topic.category}
      status={topic.status}
      price={Math.round(topic.blue_pct ?? 50)}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
