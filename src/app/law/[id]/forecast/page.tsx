import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawForecastClient } from './LawForecastClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes, established_at, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Forecast · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Forecast: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Stability forecast for this established law — repeal risk, amendment pressure, community sentiment, ` +
    `and predictive signals. Originally passed ${forPct}% FOR across ` +
    `${(law.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: law.established_at ?? undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    robots: { index: false },
  }
}

export default async function LawForecastPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawForecastClient lawId={law.id} lawStatement={law.statement} />
}
