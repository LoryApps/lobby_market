import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ActivityClient } from './ActivityClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Activity · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const title = `Activity: ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`
  const description = `Live activity stream for this debate — recent votes, new arguments, and upvotes. ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    robots: { index: false },
  }
}

export default async function TopicActivityPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <ActivityClient topicId={topic.id} topicStatement={topic.statement} />
}
