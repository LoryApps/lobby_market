import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawWikiHistoryClient } from './LawWikiHistoryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Wiki History · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const title = `Wiki History: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `View the full collaborative edit history of this law's wiki — every revision, ` +
    `who made it, and what changed. ${law.category ? law.category + ' · ' : ''}Lobby Market.`

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

export default async function LawWikiHistoryPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawWikiHistoryClient lawId={params.id} />
}
