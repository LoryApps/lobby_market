import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicDetail } from '@/components/topic/TopicDetail'
import type { Topic, Profile } from '@/lib/supabase/types'

interface TopicPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .single()

  if (!topic) {
    return { title: 'Topic · Lobby Market' }
  }

  const statusLabel: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Established Law',
    failed: 'Failed',
  }

  const label = statusLabel[topic.status] ?? topic.status
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const description = [
    `${label} · ${forPct}% For / ${againstPct}% Against`,
    topic.total_votes
      ? `${topic.total_votes.toLocaleString()} votes cast`
      : null,
    topic.category ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  const title = `${topic.statement} · Lobby Market`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: topic.created_at,
      tags: topic.category ? [topic.category] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function TopicPage({ params }: TopicPageProps) {
  const supabase = await createClient()

  const { data: topic, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !topic) {
    notFound()
  }

  const { data: author } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', topic.author_id)
    .single()

  return (
    <TopicDetail
      initialTopic={topic as Topic}
      author={(author as Profile) ?? null}
    />
  )
}
