import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawPressureClient } from './LawPressureClient'

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

  if (!law) return { title: 'Law Pressure · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 75)
  const stmt = law.statement ?? ''
  const title = `Social Pressure: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Is this law stable or under threat? Elite vs grassroots sentiment, reform momentum, ` +
    `active challenges, and a composite stability index — ` +
    `originally passed with ${forPct}% support across ${(law.total_votes ?? 0).toLocaleString()} votes.`

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
  }
}

export default async function LawPressurePage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!law) notFound()

  return (
    <LawPressureClient
      lawId={law.id}
      statement={law.statement}
      category={law.category ?? null}
      bluePct={Math.round(law.blue_pct ?? 75)}
      totalVotes={law.total_votes ?? 0}
      establishedAt={law.established_at}
    />
  )
}
