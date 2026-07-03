import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicMindMapClient } from './MindMapClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Topic Mind Map · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `${topic.statement} — Mind Map · Lobby Market`
  const description = `Visual knowledge graph for this topic: arguments, related debates, and connections. ${forPct}% For · ${100 - forPct}% Against · ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function TopicMindMapPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <TopicMindMapClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicCategory={topic.category}
    />
  )
}
