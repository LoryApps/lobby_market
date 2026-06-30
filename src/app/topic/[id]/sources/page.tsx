import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SourcesClient } from './SourcesClient'
import type { TopicSource } from '@/app/api/topics/[id]/sources/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Sources · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Sources: ${topic.statement.slice(0, 55)} · Lobby Market`
  const description = `Curated factual sources pinned to this debate — ${forPct}% For · ${100 - forPct}% Against · ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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

export default async function SourcesPage({ params }: Props) {
  const supabase = await createClient()

  const [topicResult, userResult] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, author_id')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!topicResult.data) notFound()

  const topic = topicResult.data
  const currentUserId = userResult.data.user?.id ?? null

  // Determine if the current user can manage sources
  let canManage = false
  if (currentUserId) {
    if (topic.author_id === currentUserId) {
      canManage = true
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUserId)
        .single()
      canManage =
        profile?.role === 'troll_catcher' || profile?.role === 'elder'
    }
  }

  // Fetch initial sources server-side
  const { data: rawSources } = await supabase
    .from('topic_sources')
    .select(`
      *,
      added_by_profile:profiles!topic_sources_added_by_fkey(
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('topic_id', params.id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  const initialSources: TopicSource[] = (rawSources ?? []) as TopicSource[]

  return (
    <SourcesClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicCategory={topic.category}
      topicStatus={topic.status}
      topicBluePct={topic.blue_pct ?? 50}
      topicTotalVotes={topic.total_votes ?? 0}
      currentUserId={currentUserId}
      canManage={canManage}
      initialSources={initialSources}
    />
  )
}
