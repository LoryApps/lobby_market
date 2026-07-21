import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RippleClient } from './RippleClient'

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

  if (!topic) return { title: 'Market Ripple · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Ripple: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Exchange`
  const description =
    `Discover which civic markets move in sync with this one — and which diverge. ` +
    `Markets that share voter conviction with "${stmt.slice(0, 80)}" — currently at ${price}¢.`

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

export default async function MarketRipplePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <RippleClient
      topicId={topic.id}
      statement={topic.statement}
      category={topic.category}
      status={topic.status}
      price={Math.round(topic.blue_pct ?? 50)}
      totalVotes={topic.total_votes ?? 0}
    />
  )
}
