import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExposureClient } from './ExposureClient'

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

  if (!topic) return { title: 'Market Exposure · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Exposure: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Cross-market exposure analysis for this civic prediction market. ` +
    `Category beta, correlated markets, percentile positioning, and 7-day velocity. ` +
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

export default async function MarketExposurePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <ExposureClient
      id={topic.id}
      statement={topic.statement ?? ''}
      category={topic.category}
      status={topic.status}
      price={Math.round(topic.blue_pct ?? 50)}
    />
  )
}
