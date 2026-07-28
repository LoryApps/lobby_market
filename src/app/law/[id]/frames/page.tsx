import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawFramesClient } from './LawFramesClient'

export const dynamic = 'force-dynamic'

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

  if (!law) return { title: 'Law Frames · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Ideological Frames: ${law.statement.slice(0, 55)}${law.statement.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `How 6 ideological lenses — Progressive, Conservative, Libertarian, Centrist, Technocratic, and Populist — view this established consensus law. ` +
    `Passed with ${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes. ` +
    `Understand the ideological landscape behind one of the platform's established laws.`

  return {
    title,
    description,
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
    robots: { index: false },
  }
}

export default async function LawFramesPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <LawFramesClient
      lawId={law.id}
      statement={law.statement}
      category={law.category ?? null}
      forPct={Math.round(law.blue_pct ?? 50)}
      totalVotes={law.total_votes ?? 0}
      establishedAt={law.established_at}
    />
  )
}
