import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicMoodClient } from './TopicMoodClient'

export const dynamic = 'force-dynamic'

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

  if (!topic) return { title: 'Topic Mood · Lobby Market' }

  const short = topic.statement.slice(0, 60) + (topic.statement.length > 60 ? '…' : '')
  const title = `Community Mood: ${short} · Lobby Market`
  const description = `How does the Lobby feel about this debate? See the emotional pulse — hopeful, worried, determined, inspired — from ${(topic.total_votes ?? 0).toLocaleString()} participants.`

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
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function TopicMoodPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <TopicMoodClient topicId={params.id} topic={topic} />
}
