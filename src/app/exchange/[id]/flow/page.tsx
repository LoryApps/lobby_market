import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FlowClient } from './FlowClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Flow · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt  = topic.statement ?? ''
  const title = `Flow: ${stmt.slice(0, 54)}${stmt.length > 54 ? '…' : ''} · Lobby Exchange`
  const description =
    `Directional flow analysis for this civic prediction market — vote velocity, clout-weighted ` +
    `pressure, smart money vs retail flow, and argument momentum. Currently at ${price}¢ with ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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
  }
}

export default async function MarketFlowPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  return <FlowClient topicId={params.id} />
}
