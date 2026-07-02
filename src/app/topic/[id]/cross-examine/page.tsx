import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CrossExamineClient } from './CrossExamineClient'

export const dynamic = 'force-dynamic'

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

  if (!topic) return { title: 'Cross-Examine · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement.slice(0, 70)

  return {
    title: `Cross-Examine: ${stmt} · Lobby Market`,
    description: `Interrogate the top FOR and AGAINST arguments on "${topic.statement}" — see the best rebuttals, challenge specific claims, and stress-test each position. Currently ${forPct}% FOR.`,
    openGraph: {
      title: `Cross-Examine: ${stmt} · Lobby Market`,
      description: `The strongest arguments on each side — and their best rebuttals. Stress-test every claim.`,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `Cross-Examine: ${stmt} · Lobby Market`,
      description: `Top FOR and AGAINST arguments face each other's best rebuttals. Currently ${forPct}% FOR.`,
    },
  }
}

export default async function CrossExaminePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <CrossExamineClient topicId={params.id} />
}
