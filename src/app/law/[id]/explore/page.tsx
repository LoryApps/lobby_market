import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawExploreClient } from './ExploreClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Hub · Lobby Market' }

  const title = `${law.statement} — Analysis Hub · Lobby Market`
  const description = `Explore every tool for this established law — blueprint, revisions, amendments, community reviews, AI counsel, debate record, impact analysis, and knowledge graph position.${law.category ? ` Category: ${law.category}.` : ''}`

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

export default async function LawExplorePage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, established_at, topic_id, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  let topicStatement: string | null = null

  if (law.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', law.topic_id)
      .maybeSingle()

    if (topic) {
      topicStatement = topic.statement
    }
  }

  return (
    <LawExploreClient
      lawId={law.id}
      statement={law.statement}
      category={law.category ?? null}
      totalVotes={law.total_votes ?? null}
      establishedAt={law.established_at ?? null}
      topicId={law.topic_id ?? null}
      topicStatement={topicStatement}
      bluePct={law.blue_pct ?? null}
    />
  )
}
