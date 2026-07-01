import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConsensusClient from './ConsensusClient'

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

  if (!topic) return { title: 'Common Ground · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement.slice(0, 55)
  const title = `Common Ground: ${stmt}${topic.statement.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Discover where FOR and AGAINST voters actually agree on "${topic.statement}" — shared values, common premises, and where the debate truly diverges. Currently ${forPct}% For across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/topic/${params.id}`],
    },
    robots: { index: false },
  }
}

export default async function ConsensusPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <ConsensusClient />
}
