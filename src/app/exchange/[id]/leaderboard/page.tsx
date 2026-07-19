import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketLeaderboardClient } from './MarketLeaderboardClient'

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

  if (!topic) return { title: 'Market Leaderboard · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const statement = topic.statement ?? ''
  const title = `Leaderboard: ${statement.slice(0, 50)}${statement.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Top forecasters on this civic market — ranked by entry price edge. ` +
    `Current price: ${price}¢ · ${topic.total_votes?.toLocaleString() ?? 0} total traders.`

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

export default async function MarketLeaderboardPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <MarketLeaderboardClient topicId={params.id} />
}
