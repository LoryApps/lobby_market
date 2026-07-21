import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArgumentsClient } from './ArgumentsClient'

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

  if (!topic) return { title: 'Market Arguments · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const shortStmt = stmt.length > 55 ? stmt.slice(0, 55) + '…' : stmt
  const title = `Arguments: ${shortStmt} · Lobby Exchange`
  const description =
    `Browse all FOR and AGAINST arguments on this civic prediction market. ` +
    `Current consensus: ${price}¢. ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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

export default async function ArgumentsPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <ArgumentsClient id={params.id} />
}
