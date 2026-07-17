import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TradersClient } from './TradersClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, blue_votes, red_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Traders · Lobby Exchange' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const statement = topic.statement ?? ''
  const title = `Traders: ${statement.slice(0, 50)}${statement.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `See who's long and short on this civic market. ${(topic.blue_votes ?? 0).toLocaleString()} FOR ` +
    `vs ${(topic.red_votes ?? 0).toLocaleString()} AGAINST. Current consensus: ${forPct}%.`

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

export default async function TradersPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <TradersClient topicId={params.id} />
}
