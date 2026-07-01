import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AutopsyClient } from './AutopsyClient'

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

  if (!topic) return { title: 'Debate Autopsy · Lobby Market' }

  const resolved = topic.status === 'law' || topic.status === 'failed'
  if (!resolved) return { title: 'Debate Autopsy · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const outcome = topic.status === 'law' ? 'Passed into law' : 'Motion failed'
  const title = `Autopsy: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `${outcome} · ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes. ` +
    `Full forensic breakdown: vote arc, decisive arguments, debate phases, and ${topic.category ?? 'category'} benchmark.`

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

export default async function AutopsyPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <AutopsyClient />
}
