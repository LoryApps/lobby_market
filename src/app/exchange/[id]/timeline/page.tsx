import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TimelineClient } from './TimelineClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Timeline · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const daysOld = Math.floor(
    (Date.now() - new Date(topic.created_at).getTime()) / 86_400_000
  )
  const title = `Timeline: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Exchange`
  const description =
    topic.status === 'law'
      ? `The complete story of how "${stmt.slice(0, 80)}" became Law at ${price}¢. All milestones, debates, and price events from opening to codification.`
      : `${daysOld}-day chronological history of this civic prediction market — price crossings, debates, top arguments, and consensus milestones. Currently ${price}¢ with ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function MarketTimelinePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <TimelineClient topicId={params.id} />
}
