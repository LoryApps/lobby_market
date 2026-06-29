import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JourneyClient } from './JourneyClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'My Journey · Lobby Market' }

  const stmt = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `My Journey: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Your personal civic history with this debate — your vote, arguments, and predictions. ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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
  }
}

export default async function TopicJourneyPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <JourneyClient topicId={params.id} />
}
