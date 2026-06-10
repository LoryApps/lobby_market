import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DebatePredictionsClient } from './DebatePredictionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('title, status, topic_id')
    .eq('id', params.id)
    .single()

  if (!debate) return { title: 'Debate Predictions · Lobby Market' }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  const title = `Predictions: ${debate.title} · Lobby Market`
  const description = topic
    ? `Who will win this debate? Predict the winner, sway change, and confidence level for "${topic.statement.slice(0, 80)}".`
    : 'Predict the outcome of this civic debate before it starts.'

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

export default async function DebatePredictionsPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, status')
    .eq('id', params.id)
    .single()

  if (!debate) notFound()

  return <DebatePredictionsClient debateId={params.id} />
}
