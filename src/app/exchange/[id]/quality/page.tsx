import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QualityClient } from './QualityClient'

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

  if (!topic) return { title: 'Market Quality · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Quality Score: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Market quality analysis for this civic prediction market at ${price}¢. ` +
    `Resolution clarity, trader diversity, argument quality, and price efficiency — scored for reliability. ` +
    `${(topic.total_votes ?? 0).toLocaleString()} total votes cast.`

  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function QualityPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select(`
      id, statement, category, blue_pct, total_votes, status, created_at,
      description, blue_votes
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  // Fetch argument counts by side
  const { count: argCount } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)

  const { count: forArgCount } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)
    .eq('side', 'blue')

  const { count: againstArgCount } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)
    .eq('side', 'red')

  // Fetch unique voter count
  const { count: uniqueVoters } = await supabase
    .from('votes')
    .select('user_id', { count: 'exact', head: true })
    .eq('topic_id', params.id)

  // Fetch wiki length (description)
  const wikiLength = (topic.description ?? '').length

  // Fetch debate count
  const { count: debateCount } = await supabase
    .from('debates')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)

  return (
    <QualityClient
      id={params.id}
      statement={topic.statement ?? ''}
      category={topic.category ?? null}
      status={topic.status ?? 'active'}
      currentPrice={Math.round(topic.blue_pct ?? 50)}
      totalVotes={topic.total_votes ?? 0}
      blueVotes={topic.blue_votes ?? 0}
      argCount={argCount ?? 0}
      forArgCount={forArgCount ?? 0}
      againstArgCount={againstArgCount ?? 0}
      uniqueVoters={uniqueVoters ?? 0}
      wikiLength={wikiLength}
      debateCount={debateCount ?? 0}
      createdAt={topic.created_at ?? ''}
    />
  )
}
