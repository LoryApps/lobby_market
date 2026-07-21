import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnatomyClient } from './AnatomyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Anatomy · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Anatomy: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Exchange`
  const description =
    `Structural analysis of the civic debate behind this prediction market. ` +
    `Argument quality distribution, citation rates, grade spread, and top-word analysis. ` +
    `Current consensus: ${price}¢ FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    robots: { index: false },
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

export default async function MarketAnatomyPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <AnatomyClient id={params.id} statement={topic.statement} />
}
