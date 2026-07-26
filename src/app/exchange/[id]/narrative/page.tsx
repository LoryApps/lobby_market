import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NarrativeClient } from './NarrativeClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Narrative Analysis · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const short = `${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''}`
  const title = `Narrative: ${short} · Lobby Exchange`
  const description =
    `Narrative analysis for this civic prediction market — which argument frames are winning, ` +
    `where momentum is building, and what the core tension is. ` +
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

export default async function NarrativePage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <NarrativeClient
      id={topic.id}
      statement={topic.statement}
      category={topic.category}
      status={topic.status}
      price={topic.blue_pct ?? 50}
    />
  )
}
