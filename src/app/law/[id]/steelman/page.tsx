import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawSteelmanClient } from './LawSteelmanClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Steelman · Lobby Market' }

  const stmt = law.statement
  const title = `Steelman: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `The strongest possible case for and against this established law — AI-generated steelman arguments representing each side at its most rigorous.`

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

export default async function LawSteelmanPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, topic_id, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <LawSteelmanClient
      lawId={law.id}
      topicId={law.topic_id}
      statement={law.statement}
      category={law.category ?? null}
      bluePct={law.blue_pct ?? 50}
      totalVotes={law.total_votes ?? 0}
      establishedAt={law.established_at}
    />
  )
}
