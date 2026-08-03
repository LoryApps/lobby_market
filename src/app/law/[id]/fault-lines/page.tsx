import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawFaultLinesClient } from './LawFaultLinesClient'

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

  if (!law) return { title: 'Fault Lines · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Fault Lines: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Debate fracture points from the original vote — flashpoints (most replied), ` +
    `dead certainties (high upvote, zero replies), contested ground (argued more than praised), ` +
    `and first movers (the arguments that shaped it from day one). ` +
    `${forPct}% FOR · ${100 - forPct}% AGAINST · ${(law.total_votes ?? 0).toLocaleString()} votes.`

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
    twitter: { card: 'summary_large_image', title, description, images: [`/api/og/law/${params.id}`] },
    alternates: { canonical: `https://lobby.market/law/${params.id}/fault-lines` },
  }
}

export default async function LawFaultLinesPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawFaultLinesClient lawId={params.id} />
}
