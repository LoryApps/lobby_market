import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConnectionsClient } from './ConnectionsClient'

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

  if (!law) return { title: 'Legal Connections · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Connections: ${short} · Lobby Market`
  const forPct = Math.round(law.blue_pct ?? 50)
  const description =
    `See how this law connects to the broader civic ecosystem — ` +
    `coalition positions, active sister debates, and related established laws. ` +
    `Passed ${forPct}% FOR with ${(law.total_votes ?? 0).toLocaleString()} votes${law.category ? ` in ${law.category}` : ''}.`

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
    alternates: { canonical: `https://lobby.market/law/${params.id}/connections` },
  }
}

export default async function LawConnectionsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <ConnectionsClient lawId={params.id} />
}
