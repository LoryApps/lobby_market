import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalysisClient } from './AnalysisClient'

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

  if (!topic) return { title: 'Market Analysis · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Analysis: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Exchange`
  const description =
    `Deep statistical analysis of this civic market. Current consensus: ${price}¢. ` +
    `Price history, volatility, momentum, and argument sentiment.`

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

export default async function MarketAnalysisPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <AnalysisClient id={params.id} />
}
