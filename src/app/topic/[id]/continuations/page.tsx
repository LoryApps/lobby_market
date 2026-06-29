import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContinuationsClient } from './ContinuationsClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Continuations · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const title = `What comes next: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Market`
  const description =
    'Community-proposed continuations for this debate — the "…but/and" statements that the Lobby votes to carry forward into the next link of the civic chain.'

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

export default async function TopicContinuationsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, continuation_window_ends_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <ContinuationsClient
      topicId={topic.id}
      statement={topic.statement}
      category={topic.category ?? null}
      status={topic.status}
      bluePct={topic.blue_pct ?? 50}
      totalVotes={topic.total_votes ?? 0}
      windowEndsAt={(topic as { continuation_window_ends_at?: string | null }).continuation_window_ends_at ?? null}
    />
  )
}
