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
    .select('statement, description, category, status, blue_pct, total_votes, created_at')
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
  // Use the topic's own description as OG description when available,
  // otherwise fall back to the stats summary.
  const statsSummary = [
    `${label} · ${forPct}% For / ${againstPct}% Against`,
    topic.total_votes
      ? `${topic.total_votes.toLocaleString()} votes cast`
      : null,
    topic.category ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  const topicDescription = (topic as { description?: string | null }).description
  const description = topicDescription
    ? `${topicDescription.slice(0, 160)}${topicDescription.length > 160 ? '…' : ''} · ${statsSummary}`
    : statsSummary

  const title = `${topic.statement} · Lobby Market`

  const ogImageUrl = `/api/og/topic/${params.id}`

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
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: topic.statement,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

const BASE_URL = 'https://lobby.market'

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

  const typedTopic = topic as Topic
  const forPct = Math.round(typedTopic.blue_pct ?? 50)
  const description = (typedTopic as { description?: string | null }).description

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: typedTopic.statement,
    ...(description ? { description } : {}),
    datePublished: typedTopic.created_at,
    url: `${BASE_URL}/topic/${params.id}`,
    publisher: {
      '@type': 'Organization',
      name: 'Lobby Market',
      url: BASE_URL,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/assets/logo-mark.png` },
    },
    ...(typedTopic.category ? { keywords: typedTopic.category } : {}),
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'VoteAction' },
        userInteractionCount: typedTopic.total_votes ?? 0,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'WatchAction' },
        userInteractionCount: (typedTopic as { view_count?: number }).view_count ?? 0,
      },
    ],
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'forPercentage', value: forPct },
      { '@type': 'PropertyValue', name: 'againstPercentage', value: 100 - forPct },
      { '@type': 'PropertyValue', name: 'status', value: typedTopic.status },
    ],
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Lobby Market', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Topics', item: `${BASE_URL}/trending` },
        { '@type': 'ListItem', position: 3, name: typedTopic.statement.slice(0, 80), item: `${BASE_URL}/topic/${params.id}` },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <TopicDetail
        initialTopic={typedTopic}
        author={(author as Profile) ?? null}
      />
    </>
  )
}
