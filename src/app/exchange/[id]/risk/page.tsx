import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketRiskClient } from './MarketRiskClient'

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

  if (!topic) return { title: 'Market Risk · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt  = topic.statement ?? ''
  const title = `Risk: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    topic.status === 'law'
      ? `Risk analysis for this civic law: price extremity, volatility history, coalition alignment, and sentiment divergence across the market lifecycle.`
      : `Six-dimension risk intelligence for this civic prediction market — price extremity, volatility, liquidity depth, coalition disagreement, deadline pressure, and sentiment divergence. Currently at ${price}¢ with ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function MarketRiskPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <MarketRiskClient id={params.id} />
}
