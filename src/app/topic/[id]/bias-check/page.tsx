import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BiasCheckClient } from './BiasCheckClient'

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

  if (!topic) return { title: 'Bias Check · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Debate Balance Check: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Analyse the balance of this debate — argument volume, community engagement, depth, and source quality on both sides. Currently ${forPct}% For across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function BiasCheckPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <BiasCheckClient topicId={params.id} topicStatement={topic.statement} />
}
