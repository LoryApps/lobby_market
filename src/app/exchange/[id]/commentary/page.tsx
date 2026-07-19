import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketCommentaryClient } from './MarketCommentaryClient'
import type { MarketSummary } from './MarketCommentaryClient'

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

  if (!topic) return { title: 'Market Commentary · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const statement = topic.statement ?? ''
  const title = `Commentary: ${statement.slice(0, 50)}${statement.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Trader takes on this civic prediction market — currently at ${price}¢ with ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast. Share your market view.`

  return {
    title,
    description,
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
    robots: { index: false },
  }
}

export default async function MarketCommentaryPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  const market: MarketSummary = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category ?? null,
    status: topic.status,
    blue_pct: topic.blue_pct ?? null,
    total_votes: topic.total_votes ?? null,
  }

  return <MarketCommentaryClient id={params.id} market={market} />
}
