import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DissentClient } from './DissentClient'

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

  if (!law) return { title: 'Loyal Opposition · Lobby Market' }

  const againstPct = Math.round(100 - (law.blue_pct ?? 50))
  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Loyal Opposition: ${short} · Lobby Market`
  const description =
    `${againstPct}% of voters (${Math.round(((law.total_votes ?? 0) * againstPct) / 100).toLocaleString()} citizens) opposed this law. ` +
    `See the dissenting arguments, civic veto challenges, and amendment proposals that push back on this consensus${law.category ? ` in ${law.category}` : ''}.`

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

export default async function LawDissentPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <DissentClient lawId={params.id} />
}
