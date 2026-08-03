import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SentimentClient } from './SentimentClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Community Sentiment · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Sentiment: ${short} · Lobby Market`
  const description =
    `How does the community feel about this law now that it's established? ` +
    `Star ratings, argument tone, challenge pressure, and overall civic sentiment. ` +
    `Passed ${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes${law.category ? ` · ${law.category}` : ''}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
  }
}

export default async function LawSentimentPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <SentimentClient lawId={params.id} />
}
