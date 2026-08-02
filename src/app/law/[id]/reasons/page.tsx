import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawReasonsClient } from './ReasonsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Vote Reasons · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Why The Nation Voted: ${short} · Lobby Market`
  const description =
    `Anonymous hot takes from the ${(law.total_votes ?? 0).toLocaleString()} citizens who voted on this law — ` +
    `${forPct}% For, ${100 - forPct}% Against.${law.category ? ` Category: ${law.category}.` : ''}`

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
    alternates: {
      canonical: `https://lobby.market/law/${params.id}/reasons`,
    },
    robots: { index: true, follow: true },
  }
}

export default async function LawReasonsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawReasonsClient />
}
