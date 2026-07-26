import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImpactClient } from './ImpactClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status, scope')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Civic Impact · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const short = `${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''}`
  const title = `Impact: ${short} · Lobby Exchange`
  const description =
    `Civic impact analysis for "${stmt.slice(0, 80)}" — if this market resolves as LAW, ` +
    `how many related topics and categories are affected? Currently at ${price}¢ with ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function ImpactPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, scope')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <ImpactClient
      id={topic.id}
      statement={topic.statement}
      category={topic.category}
      status={topic.status}
      price={topic.blue_pct ?? 50}
      scope={topic.scope ?? null}
    />
  )
}
