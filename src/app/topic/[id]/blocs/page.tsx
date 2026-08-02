import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BlocsClient } from './BlocsClient'

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

  if (!topic) return { title: 'Voting Blocs · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Voting Blocs: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `How different civic roles, clout tiers, and coalitions voted on this topic — ` +
    `${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes. ` +
    `See whether Lawmakers, Elders, and Debaters agree.`

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
    alternates: {
      canonical: `https://lobby.market/topic/${params.id}/blocs`,
    },
  }
}

export default async function TopicBlocsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <BlocsClient
      topicId={topic.id}
      statement={topic.statement ?? ''}
      category={topic.category ?? null}
      status={topic.status ?? 'active'}
    />
  )
}
