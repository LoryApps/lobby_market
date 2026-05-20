import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MomentumClient } from './MomentumClient'

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

  if (!topic) return { title: 'Momentum · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Vote Momentum: ${topic.statement.slice(0, 60)} · Lobby Market`
  const description = `How the FOR/AGAINST balance evolved over the life of this debate — currently ${forPct}% For across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export interface DebateEvent {
  id: string
  title: string
  scheduled_at: string
  status: string
  type: string
}

export interface MomentumPageData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }
  debates: DebateEvent[]
}

export default async function MomentumPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  const { data: debateRows } = await supabase
    .from('debates')
    .select('id, title, scheduled_at, status, type')
    .eq('topic_id', params.id)
    .order('scheduled_at', { ascending: true })
    .limit(20)

  const debates: DebateEvent[] = (debateRows ?? []).map((d) => ({
    id: d.id,
    title: d.title ?? 'Debate',
    scheduled_at: d.scheduled_at,
    status: d.status,
    type: d.type,
  }))

  const pageData: MomentumPageData = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      created_at: topic.created_at,
    },
    debates,
  }

  return <MomentumClient data={pageData} />
}
