import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BlueprintClient } from './BlueprintClient'

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

  if (!topic) return { title: 'Policy Blueprint · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Blueprint: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Market`
  const description =
    `Policy implementation blueprint for "${stmt.slice(0, 80)}${stmt.length > 80 ? '…' : ''}". ` +
    `Currently ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes. ` +
    `See phased rollout plan, stakeholder analysis, and community evidence base.`

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
    robots: { index: false },
  }
}

export default async function BlueprintPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <BlueprintClient topicId={topic.id} topicStatement={topic.statement} />
}
