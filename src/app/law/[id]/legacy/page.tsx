import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LegacyClient } from './LegacyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 1800

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

  if (!law) return { title: 'Law Legacy · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(law.blue_pct ?? 50)
  const year = new Date(law.established_at).getFullYear()
  const title = `Legacy: ${short} · Lobby Market`
  const description =
    `The lasting legacy of this ${year} law — passed ${forPct}% FOR by ` +
    `${(law.total_votes ?? 0).toLocaleString()} citizens. ` +
    `Community verdicts, formal challenges, amendments, and the debates it inspired.` +
    `${law.category ? ` · ${law.category}` : ''}`

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
    alternates: { canonical: `https://lobby.market/law/${params.id}/legacy` },
  }
}

export default async function LawLegacyPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LegacyClient lawId={params.id} />
}
