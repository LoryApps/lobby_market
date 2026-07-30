import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawPulseClient } from './LawPulseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes, established_at, is_active')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Pulse · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const title = `Pulse: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Live activity feed for established law: "${stmt.slice(0, 80)}". ` +
    `Track reviews, discussions, wiki edits, challenges, and amendments happening right now.`

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

export default async function LawPulsePage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawPulseClient lawId={law.id} lawStatement={law.statement} />
}
