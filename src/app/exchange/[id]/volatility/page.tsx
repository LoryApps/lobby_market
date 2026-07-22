import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VolatilityClient } from './VolatilityClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Volatility · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt  = topic.statement ?? ''
  const title = `Volatility: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Exchange`
  const description =
    `Full volatility analysis for this civic prediction market — standard deviation, price range, ` +
    `choppiness score, max drawdown, and trend consistency. Currently at ${price}¢ with ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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
  }
}

export default async function MarketVolatilityPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  return <VolatilityClient topicId={params.id} />
}
