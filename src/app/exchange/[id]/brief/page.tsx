import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BriefClient } from './BriefClient'

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

  if (!topic) return { title: 'Market Brief · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const statement = topic.statement ?? ''
  const title = `Brief: ${statement.slice(0, 50)}${statement.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `One-page market brief — current consensus ${price}¢, ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast. ` +
    `Top arguments FOR and AGAINST, resolution outlook, and quick vote.`

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

export default async function MarketBriefPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <BriefClient id={params.id} />
}
