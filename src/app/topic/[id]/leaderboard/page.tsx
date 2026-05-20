import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardClient } from './LeaderboardClient'

export const dynamic = 'force-dynamic'

interface LeaderboardPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: LeaderboardPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, total_votes, status')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Leaderboard · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const title = `Leaderboard · ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Top argument writers, predictors, and overall contributors for this topic — ranked by impact.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    robots: { index: false },
  }
}

export default async function TopicLeaderboardPage({ params }: LeaderboardPageProps) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .single()

  if (!topic) notFound()

  return <LeaderboardClient />
}
