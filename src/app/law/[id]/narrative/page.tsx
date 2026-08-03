import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawNarrativeClient } from './LawNarrativeClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Narrative · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Narrative: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `The story of how this civic debate became established law — ${forPct}% For, ` +
    `${(law.total_votes ?? 0).toLocaleString()} votes cast. The original question, ` +
    `the debate, and what the community's consensus means.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
  }
}

export default async function LawNarrativePage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <LawNarrativeClient
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
