import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LegacyClient } from './LegacyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

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

  if (!topic) return { title: 'Civic Legacy · Lobby Market' }

  if (topic.status !== 'law' && topic.status !== 'failed') {
    return {
      title: `Civic Legacy · Lobby Market`,
      description: `The legacy page is available after this debate resolves.`,
    }
  }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const outcome = topic.status === 'law' ? 'passed into law' : 'motion failed'
  const title = `Legacy: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `The civic legacy of this resolved debate — ${outcome} at ${forPct}% FOR ` +
    `across ${(topic.total_votes ?? 0).toLocaleString()} votes. ` +
    `Coalition records, memorial arguments, citations, and historical context.`

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
    },
  }
}

export default async function LegacyPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <LegacyClient topicId={params.id} />
}
