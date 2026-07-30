import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SimilarTopicsClient } from './SimilarTopicsClient'

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

  if (!topic) return { title: 'Similar Topics · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Similar: ${short} · Lobby Market`
  const description =
    `Discover civic debates related to "${stmt}" — ` +
    `topics that share tags, voter patterns, or category with this debate. ` +
    `${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630, alt: stmt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export interface SourceTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export default async function SimilarTopicsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <SimilarTopicsClient
      topicId={params.id}
      topic={topic as SourceTopic}
    />
  )
}
