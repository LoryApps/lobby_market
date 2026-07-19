import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoalitionsClient } from './CoalitionsClient'

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

  if (!topic) return { title: 'Coalition Breakdown · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Coalitions: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `See how civic coalitions are positioned on this market. Official stances, member vote breakdown, ` +
    `and alignment rates — current consensus ${price}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function MarketCoalitionsPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <CoalitionsClient topicId={params.id} />
}
