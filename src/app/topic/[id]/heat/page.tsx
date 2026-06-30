import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HeatClient } from './HeatClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, total_votes, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Vote Heatmap · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Vote Heatmap: ${topic.statement.slice(0, 60)}${topic.statement.length > 60 ? '…' : ''} · Lobby Market`
  const description =
    `When do people vote on this debate? See peak voting hours and days — ` +
    `${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes${topic.category ? ` in ${topic.category}` : ''}.`

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
    robots: { index: false },
  }
}

export default async function HeatPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <HeatClient
      topicId={topic.id}
      topicStatement={topic.statement}
    />
  )
}
