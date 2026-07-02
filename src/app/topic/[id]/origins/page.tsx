import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OriginsClient } from './OriginsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Debate Origins · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const createdYear = topic.created_at ? new Date(topic.created_at).getFullYear() : ''
  const title = `Origins: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Market`
  const description =
    `How did this debate begin? Trace the founding arguments, pioneer voters, and first-week momentum. ` +
    `${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} total votes. ` +
    `Proposed ${createdYear ? `in ${createdYear}` : 'on Lobby Market'}.`

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
    robots: { index: true },
  }
}

export default async function OriginsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <OriginsClient topicId={topic.id} topicStatement={topic.statement} />
}
