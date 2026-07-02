import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlaybookClient } from './PlaybookClient'
import type { PlaybookTopic, PlaybookArg, PlaybookCoalitionStance } from './PlaybookClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  if (!topic) return { title: 'Playbook · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Playbook: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Campaign playbook for both sides of this debate — top arguments, rebuttals, ` +
    `persuasion tactics, and the path to victory. ${forPct}% For · ${100 - forPct}% Against · ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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

export default async function PlaybookPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes, scope, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  // Fetch top arguments for both sides and coalition stances in parallel
  const [blueArgs, redArgs, coalitionStances] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, ai_score, ai_grade, source_url, created_at')
      .eq('topic_id', params.id)
      .eq('side', 'blue')
      .order('upvotes', { ascending: false })
      .limit(6),
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, ai_score, ai_grade, source_url, created_at')
      .eq('topic_id', params.id)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .limit(6),
    supabase
      .from('coalition_stances')
      .select(`
        id, stance, statement,
        coalition:coalitions(id, name, color, badge_emoji, member_count)
      `)
      .eq('topic_id', params.id)
      .limit(8),
  ])

  return (
    <PlaybookClient
      topic={topic as unknown as PlaybookTopic}
      blueArgs={(blueArgs.data ?? []) as unknown as PlaybookArg[]}
      redArgs={(redArgs.data ?? []) as unknown as PlaybookArg[]}
      coalitionStances={(coalitionStances.data ?? []) as unknown as PlaybookCoalitionStance[]}
    />
  )
}
