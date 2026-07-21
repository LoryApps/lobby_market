import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DigestClient } from './DigestClient'

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

  if (!topic) return { title: 'Weekly Digest · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement ?? ''
  const shortStmt = stmt.length > 50 ? stmt.slice(0, 50) + '…' : stmt
  const title = `Digest: ${shortStmt} · Lobby Exchange`
  const description =
    `7-day market digest — current consensus ${price}¢, ` +
    `${(topic.total_votes ?? 0).toLocaleString()} total votes. ` +
    `New arguments, top commentary, and forecaster consensus for the week.`

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

export default async function DigestPage({ params }: Props) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  return <DigestClient id={params.id} />
}
