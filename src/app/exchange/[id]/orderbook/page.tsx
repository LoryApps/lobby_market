import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderbookClient } from './OrderbookClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Order Book · Lobby Exchange' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const statement = topic.statement ?? ''
  const title = `Order Book: ${statement.slice(0, 55)}${statement.length > 55 ? '…' : ''} · Lobby Exchange`
  const description =
    `Depth chart and vote distribution for this civic market. Current consensus: ${forPct}% FOR. ` +
    `${topic.total_votes?.toLocaleString() ?? 0} total votes cast.`

  return {
    title,
    description,
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
    robots: { index: false },
  }
}

export default async function OrderbookPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <OrderbookClient topicId={params.id} />
}
