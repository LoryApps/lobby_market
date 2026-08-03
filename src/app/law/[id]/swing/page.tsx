import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawSwingClient } from './LawSwingClient'

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

  if (!law) return { title: 'Swing Analysis · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 75)
  const stmt = law.statement ?? ''
  const title = `Swing Analysis: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `How was this law won? Founding debate momentum, archetype swing segments, and decisive arguments — ` +
    `passed with ${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
    robots: { index: false },
  }
}

export default async function LawSwingPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <LawSwingClient
      lawId={law.id}
      lawStatement={law.statement}
      lawCategory={law.category}
      lawBluePct={law.blue_pct}
      lawEstablishedAt={law.established_at}
    />
  )
}
