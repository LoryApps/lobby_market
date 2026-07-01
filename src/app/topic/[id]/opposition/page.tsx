import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OppositionClient } from './OppositionClient'

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

  if (!topic) return { title: 'Opposition Playbook · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct  = Math.round(topic.blue_pct ?? 50)
  const againPct = 100 - forPct
  const minority  = forPct <= againPct ? 'FOR' : 'AGAINST'
  const minorityPct = Math.min(forPct, againPct)

  const title = `Opposition Playbook: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Market`
  const description =
    `The ${minority} side holds ${minorityPct}% — see their strongest arguments, ` +
    `top voices, rhetorical patterns, and what would change their minds. ` +
    `${(topic.total_votes ?? 0).toLocaleString()} total votes cast.`

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
      images: [`/api/og/topic/${params.id}`],
    },
    robots: { index: false },
  }
}

export default async function OppositionPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <OppositionClient topicId={params.id} />
}
