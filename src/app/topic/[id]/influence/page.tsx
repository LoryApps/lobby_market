import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InfluenceClient } from './InfluenceClient'

export const dynamic = 'force-dynamic'

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

  if (!topic) return { title: 'Influence Map · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Influence Map: ${topic.statement.slice(0, 55)}${topic.statement.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Which arguments drove this debate? The Influence Map ranks every argument by its composite impact — upvotes, discussion power, and AI quality score. Currently ${forPct}% For across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function InfluencePage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <InfluenceClient topicId={params.id} />
}
