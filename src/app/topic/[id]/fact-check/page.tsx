import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FactCheckClient } from './FactCheckClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export interface FactCheckArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author_username: string | null
  author_avatar_url: string | null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Argument Fact-Check · Lobby Market' }

  const stmt = topic.statement ?? ''
  const title = `Fact-Check: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Check the top arguments in this debate against the Lobby Market Codex — ` +
    `see which claims are Supported, Contradicted, or Mixed by established community laws.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function FactCheckPage({ params }: Props) {
  const supabase = await createClient()

  const [topicRes, argsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('topic_arguments')
      .select(
        `id, content, side, upvotes,
         profiles!topic_arguments_author_id_fkey(username, avatar_url)`,
      )
      .eq('topic_id', params.id)
      .in('side', ['blue', 'red'])
      .order('upvotes', { ascending: false })
      .limit(20),
  ])

  if (!topicRes.data) notFound()

  const topic = topicRes.data

  // Pick top 5 FOR and top 5 AGAINST
  const raw = (argsRes.data ?? []) as Array<{
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    profiles: { username: string; avatar_url: string | null } | null
  }>

  const forArgs = raw.filter((a) => a.side === 'blue').slice(0, 5)
  const againstArgs = raw.filter((a) => a.side === 'red').slice(0, 5)

  const arguments_: FactCheckArgument[] = [...forArgs, ...againstArgs].map((a) => ({
    id: a.id,
    content: a.content,
    side: a.side,
    upvotes: a.upvotes,
    author_username: a.profiles?.username ?? null,
    author_avatar_url: a.profiles?.avatar_url ?? null,
  }))

  return (
    <FactCheckClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicCategory={topic.category}
      topicStatus={topic.status}
      topicForPct={Math.round(topic.blue_pct ?? 50)}
      topicTotalVotes={topic.total_votes ?? 0}
      arguments={arguments_}
    />
  )
}
