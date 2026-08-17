import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawCensusClient } from './LawCensusClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  if (!law) return { title: 'Law Voter Census · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Voter Census: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Who voted to establish this law? Demographic breakdown — seniority, civic role, clout standing, and activity level ` +
    `across ${(law.total_votes ?? 0).toLocaleString()} votes — ${forPct}% FOR when passed.`

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
    },
    robots: { index: false },
  }
}

export default async function LawCensusPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <LawCensusClient
      lawId={law.id}
      lawStatement={law.statement ?? ''}
      category={law.category ?? null}
      establishedAt={law.established_at ?? null}
      blue_pct={law.blue_pct ?? 50}
      total_votes={law.total_votes ?? 0}
      topicId={law.topic_id ?? null}
    />
  )
}
