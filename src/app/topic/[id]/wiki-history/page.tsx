import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WikiHistoryClient } from './WikiHistoryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Wiki History · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const title = `Wiki History: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `View the full collaborative edit history of this topic's wiki — every revision, ` +
    `who made it, and what changed. ${topic.category ? topic.category + ' · ' : ''}Lobby Market.`

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

export default async function WikiHistoryPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <WikiHistoryClient topicId={params.id} />
}
