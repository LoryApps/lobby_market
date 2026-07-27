import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SwingClient } from './SwingClient'

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

  if (!topic) return { title: 'Swing Analysis · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Swing Analysis: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Detect major price swings and momentum shifts in this civic prediction market at ${price}¢. ` +
    `Identify what triggered each move, measure swing magnitude, and spot reversal patterns. ` +
    `${(topic.total_votes ?? 0).toLocaleString()} total votes.`

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

export default async function SwingPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <SwingClient
      id={params.id}
      statement={topic.statement ?? ''}
      category={topic.category ?? null}
      status={topic.status ?? 'active'}
      currentPrice={Math.round(topic.blue_pct ?? 50)}
      totalVotes={topic.total_votes ?? 0}
      createdAt={topic.created_at ?? ''}
    />
  )
}
