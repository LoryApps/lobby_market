import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlaybookClient } from './PlaybookClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('topics')
      .select('statement, category, blue_pct, total_votes, status')
      .eq('id', params.id)
      .single()

    if (!data) return { title: 'Playbook · Lobby Exchange' }

    const price = Math.round(data.blue_pct ?? 50)
    const stmt  = data.statement ?? ''
    const title = `Playbook: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
    const description = `Market stage, trend signals, price levels, and category benchmarks for this market at ${price}¢ FOR — your strategic guide to reading the consensus.`

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
  } catch {
    return { title: 'Playbook · Lobby Exchange' }
  }
}

export default async function PlaybookPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <PlaybookClient marketId={params.id} statement={topic.statement} />
}
