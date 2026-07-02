import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MandateClient } from './MandateClient'

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

  if (!topic) return { title: 'Mandate Meter · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const mandateClass =
    forPct >= 85 ? 'Decisive Mandate' :
    forPct >= 75 ? 'Strong Mandate' :
    forPct >= 60 ? 'Building Mandate' :
    forPct >= 40 ? 'Contested' :
    forPct >= 25 ? 'Opposition Majority' :
    'Strong Rejection'

  const title = `Mandate: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Market`
  const description =
    `${mandateClass} — ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes. ` +
    `See the consensus strength, law threshold distance, and vote momentum for this civic debate.`

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

export default async function MandatePage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <MandateClient topicId={topic.id} topicStatement={topic.statement} />
}
