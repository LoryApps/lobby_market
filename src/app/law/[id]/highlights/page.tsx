import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HighlightsClient } from './HighlightsClient'

export const dynamic = 'force-dynamic'

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

  if (!law) return { title: 'Law Highlights · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Highlights: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Best moments from the civic debate that became this law — founding argument, strongest opposition, and the voice that helped it pass. ${forPct}% For · ${(law.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [
        {
          url: `/api/og/law/${params.id}`,
          width: 1200,
          height: 630,
          alt: stmt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
    alternates: {
      canonical: `https://lobby.market/law/${params.id}/highlights`,
    },
  }
}

export default async function LawHighlightsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <HighlightsClient
      lawId={params.id}
      statement={law.statement}
      category={law.category}
      establishedAt={law.established_at}
      bluePct={law.blue_pct ?? 50}
      totalVotes={law.total_votes ?? 0}
    />
  )
}
