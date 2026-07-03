import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HindsightClient } from './HindsightClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Hindsight · Lobby Market' }

  if (topic.status !== 'law' && topic.status !== 'failed') {
    return {
      title: 'Hindsight · Lobby Market',
      description: 'Hindsight voting is available after this topic resolves.',
    }
  }

  const stmt = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const outcome = topic.status === 'law' ? 'passed into law' : 'failed'
  const title = `Hindsight: ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`
  const description =
    `This debate ${outcome} with ${forPct}% FOR · ${(topic.total_votes ?? 0).toLocaleString()} votes cast. ` +
    `Was the community right? Share your retrospective verdict.`

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

export default async function HindsightPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  if (topic.status !== 'law' && topic.status !== 'failed') {
    notFound()
  }

  return <HindsightClient />
}
