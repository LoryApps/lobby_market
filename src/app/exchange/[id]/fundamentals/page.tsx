import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FundamentalsClient } from './FundamentalsClient'

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

  if (!topic) return { title: 'Market Fundamentals · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const title = `Fundamentals: ${stmt.slice(0, 48)}${stmt.length > 48 ? '…' : ''} · Lobby Exchange`
  const description =
    `Claim integrity analysis for this civic prediction market. ` +
    `Citation rates, argument balance, AI quality distribution, and category benchmarks. ` +
    `Current consensus: ${price}¢ FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    robots: { index: false },
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

export default async function MarketFundamentalsPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <FundamentalsClient id={params.id} statement={topic.statement} />
}
