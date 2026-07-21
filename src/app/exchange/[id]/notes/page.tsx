import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotesClient } from './NotesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Notes · Lobby Exchange' }

  const stmt = topic.statement ?? ''
  const title = `Notes: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Exchange`
  const description = `Private research notes and thesis for this civic prediction market.`

  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function MarketNotesPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, status, scope, total_votes, voting_ends_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <NotesClient
      id={params.id}
      statement={topic.statement ?? ''}
      category={topic.category ?? null}
      price={Math.round(topic.blue_pct ?? 50)}
      status={topic.status ?? 'live'}
      scope={topic.scope ?? null}
      totalVotes={topic.total_votes ?? 0}
      votingEndsAt={topic.voting_ends_at ?? null}
    />
  )
}
