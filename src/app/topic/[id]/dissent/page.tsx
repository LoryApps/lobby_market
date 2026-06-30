import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DissentClient } from './DissentClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Dissent · Lobby Market' }

  const bluePct = Math.round(topic.blue_pct ?? 50)
  const redPct = 100 - bluePct
  const minoritySide = bluePct <= redPct ? 'FOR' : 'AGAINST'
  const minorityPct = Math.min(bluePct, redPct)
  const stmt: string = topic.statement ?? ''

  const title = `Minority Report: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `The ${minorityPct}% ${minoritySide} minority in this debate — their strongest arguments, ` +
    `who's making them, and why the losing side deserves civic attention. ` +
    `${(topic.total_votes ?? 0).toLocaleString()} total votes cast.`

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
    robots: { index: false },
  }
}

export default async function DissentPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <DissentClient topicId={params.id} />
}
