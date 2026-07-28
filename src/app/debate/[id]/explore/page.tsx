import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DebateExploreClient } from './ExploreClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford Debate',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  cancelled: 'Cancelled',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('title, type, status, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) return { title: 'Debate Hub · Lobby Market' }

  const type = TYPE_LABEL[debate.type] ?? debate.type
  const status = STATUS_LABEL[debate.status] ?? debate.status
  const title = `${debate.title ?? 'Untitled Debate'} · Lobby Market`
  const description = `Explore every analysis tool for this ${type.toLowerCase()} — transcript, replay, AI analysis, audience verdict, performance stats, and predictions. ${status}.`

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

export default async function DebateExplorePage({ params }: Props) {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, type, status, topic_id, scheduled_at, viewer_count, description')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) notFound()

  let topicStatement: string | null = null
  let category: string | null = null

  if (debate.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', debate.topic_id)
      .maybeSingle()

    if (topic) {
      topicStatement = topic.statement
      category = topic.category ?? null
    }
  }

  return (
    <DebateExploreClient
      debateId={debate.id}
      title={debate.title ?? 'Untitled Debate'}
      type={debate.type ?? 'oxford'}
      status={debate.status ?? 'scheduled'}
      topicId={debate.topic_id ?? null}
      topicStatement={topicStatement}
      category={category}
      scheduledAt={debate.scheduled_at ?? null}
      viewerCount={debate.viewer_count ?? 0}
    />
  )
}
