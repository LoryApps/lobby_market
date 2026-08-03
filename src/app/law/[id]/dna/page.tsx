import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawDNAClient } from './LawDNAClient'

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
    .eq('is_active', true)
    .maybeSingle()

  if (!law) return { title: 'Law DNA · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 50)
  const stmt = law.statement
  const title = `Law DNA: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Decode the founding argument DNA of this law — which reasoning types dominated when it was debated, ` +
    `the core value tension that defined the vote, and which laws share the same civic genetic fingerprint. ` +
    `Passed with ${forPct}% support across ${(law.total_votes ?? 0).toLocaleString()} votes.`

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

export default async function LawDNAPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, is_active')
    .eq('id', params.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!law) notFound()

  return <LawDNAClient lawId={params.id} />
}
