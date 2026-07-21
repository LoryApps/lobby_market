import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VerdictClient } from './VerdictClient'

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

    if (!data) return { title: 'Community Verdict · Lobby Exchange' }

    const price = Math.round(data.blue_pct ?? 50)
    const stmt = data.statement ?? ''
    const verdictWord =
      price >= 72 ? 'STRONG FOR' :
      price >= 58 ? 'LEANING FOR' :
      price >= 43 ? 'DEADLOCKED' :
      price >= 29 ? 'LEANING AGAINST' : 'STRONG AGAINST'

    const title = `Verdict: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
    const description =
      `Community verdict: ${verdictWord} at ${price}¢ FOR with ${(data.total_votes ?? 0).toLocaleString()} votes. ` +
      `Confidence score, top arguments, forecaster consensus, and resolved comparables.`

    return {
      title,
      description,
      robots: { index: false },
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
    return { title: 'Community Verdict · Lobby Exchange' }
  }
}

export default async function VerdictPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <VerdictClient
      marketId={topic.id}
      statement={topic.statement ?? ''}
      category={topic.category}
    />
  )
}
