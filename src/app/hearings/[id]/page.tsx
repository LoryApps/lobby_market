import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HearingDetailClient } from './HearingDetailClient'

interface HearingPageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

const RECOMMENDATION_LABEL: Record<string, string> = {
  for: 'Committee Recommends: FOR',
  against: 'Committee Recommends: AGAINST',
  hold: 'Committee Recommends: HOLD',
  neutral: 'No Recommendation Issued',
}

export async function generateMetadata({ params }: HearingPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: hearing } = await supabase
    .from('civic_hearings')
    .select('title, description, committee, status, recommendation, testimony_count, created_at')
    .eq('id', params.id)
    .single()

  if (!hearing) {
    return { title: 'Hearing · Lobby Market' }
  }

  const statusLabel = hearing.status === 'open' ? 'Open' : hearing.status === 'closed' ? 'Closed' : 'Archived'
  const recLabel = hearing.recommendation ? RECOMMENDATION_LABEL[hearing.recommendation] : null
  const title = `${hearing.title} · ${hearing.committee} Committee`
  const description = [
    hearing.description ? hearing.description.slice(0, 120) : null,
    `${hearing.committee} Committee · ${statusLabel}`,
    hearing.testimony_count ? `${hearing.testimony_count} testimonies` : null,
    recLabel,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    title: `${title} · Lobby Market`,
    description,
    openGraph: {
      title: `${title} · Lobby Market`,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: hearing.created_at,
    },
    twitter: {
      card: 'summary',
      title: `${title} · Lobby Market`,
      description,
    },
  }
}

export default async function HearingPage({ params }: HearingPageProps) {
  const supabase = await createClient()

  const { data: hearing } = await supabase
    .from('civic_hearings')
    .select('id, topic_id, committee, title, description, status, recommendation, rationale, testimony_count, created_at, closed_at')
    .eq('id', params.id)
    .single()

  if (!hearing) notFound()

  // Fetch related topic if linked
  let topicStatement: string | null = null
  let topicCategory: string | null = null
  if (hearing.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', hearing.topic_id)
      .single()
    topicStatement = topic?.statement ?? null
    topicCategory = topic?.category ?? null
  }

  // Fetch chair profile
  const { data: chairData } = await supabase
    .from('civic_hearings')
    .select('chair_id')
    .eq('id', params.id)
    .single()

  let chair: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null = null
  if (chairData?.chair_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role')
      .eq('id', chairData.chair_id)
      .single()
    chair = profile ?? null
  }

  // Stance breakdown counts
  const { data: stanceCounts } = await supabase
    .from('civic_testimonies')
    .select('stance')
    .eq('hearing_id', params.id)

  const forCount = stanceCounts?.filter((t: { stance: string }) => t.stance === 'for').length ?? 0
  const againstCount = stanceCounts?.filter((t: { stance: string }) => t.stance === 'against').length ?? 0
  const neutralCount = stanceCounts?.filter((t: { stance: string }) => t.stance === 'neutral').length ?? 0

  return (
    <HearingDetailClient
      hearing={{
        id: hearing.id,
        topic_id: hearing.topic_id,
        topic_statement: topicStatement,
        topic_category: topicCategory,
        committee: hearing.committee,
        title: hearing.title,
        description: hearing.description,
        chair,
        status: hearing.status as 'open' | 'closed' | 'archived',
        recommendation: hearing.recommendation as 'for' | 'against' | 'hold' | 'neutral' | null,
        rationale: hearing.rationale,
        testimony_count: hearing.testimony_count,
        for_count: forCount,
        against_count: againstCount,
        neutral_count: neutralCount,
        created_at: hearing.created_at,
        closed_at: hearing.closed_at,
      }}
    />
  )
}
