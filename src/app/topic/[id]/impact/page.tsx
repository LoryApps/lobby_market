import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ImpactClient } from './ImpactClient'

interface Props {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Argument Impact · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Argument Impact · ${topic.statement.slice(0, 55)} · Lobby Market`
  const description = `Which arguments moved the needle? Ranked by upvotes, AI quality score, and engagement — ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function ImpactPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .single()

  if (!topic) notFound()

  return <ImpactClient topicId={params.id} />
}
