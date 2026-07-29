import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawMomentumClient } from './LawMomentumClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, established_at, total_votes, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Momentum · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Momentum: ${short} · Lobby Market`
  const estYear = law.established_at ? new Date(law.established_at).getFullYear() : null
  const forPct = Math.round(law.blue_pct ?? 50)
  const description =
    `Track community engagement since this law was established${estYear ? ` in ${estYear}` : ''} — ` +
    `amendment proposals, wiki activity, and citizen reviews. ` +
    `Passed with ${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: law.established_at,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function LawMomentumPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawMomentumClient lawId={params.id} />
}
