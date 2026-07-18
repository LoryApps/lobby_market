import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketIdeasClient } from './MarketIdeasClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Ideas · Lobby Exchange' }

  const price = topic.blue_pct !== null ? `${Math.round(topic.blue_pct)}¢` : ''
  const title = `Ideas: ${topic.statement.slice(0, 60)}${topic.statement.length > 60 ? '…' : ''}`

  return {
    title: `${title} · Lobby Exchange`,
    description: `Community prediction theses for "${topic.statement}" — ${price ? `trading at ${price}. ` : ''}Share your call, target price, and reasoning.`,
    robots: { index: false },
    openGraph: {
      title: `Market Ideas · Lobby Exchange`,
      description: `Crowd-sourced prediction theses for this civic market${price ? ` (${price})` : ''}. See what the community expects.`,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `Market Ideas · Lobby Exchange`,
      description: `Community theses and predictions for this civic market.`,
    },
  }
}

export default async function MarketIdeasPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, ends_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <MarketIdeasClient topic={topic} />
}
