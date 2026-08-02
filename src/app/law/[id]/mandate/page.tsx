import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MandateClient } from './MandateClient'

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

  if (!law) return { title: 'Civic Mandate · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 75)
  const cls = forPct >= 85 ? 'Decisive Mandate' : 'Strong Mandate'
  const title = `${cls}: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Market`
  const description = `This law passed with ${forPct}% civic support across ${(law.total_votes ?? 0).toLocaleString()} votes. See how its mandate compares to every other law in the Codex.`

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
    alternates: {
      canonical: `https://lobby.market/law/${params.id}/mandate`,
    },
  }
}

export default async function LawMandatePage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <MandateClient
      lawId={params.id}
      statement={law.statement}
      category={law.category}
      establishedAt={law.established_at}
      bluePct={law.blue_pct ?? 75}
      totalVotes={law.total_votes ?? 0}
    />
  )
}
