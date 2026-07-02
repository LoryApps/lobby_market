import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CommonGroundClient } from './CommonGroundClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  if (!topic) return { title: 'Common Ground · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement.slice(0, 65)

  return {
    title: `Common Ground: ${stmt}${topic.statement.length > 65 ? '…' : ''} · Lobby Market`,
    description:
      `Where do both sides agree on "${topic.statement}"? ` +
      `Discover nuanced arguments that acknowledge the opposing view, shared vocabulary, ` +
      `and the debate's overall civility score. Currently ${forPct}% FOR.`,
    openGraph: {
      title: `Common Ground: ${stmt} · Lobby Market`,
      description:
        'Find where FOR and AGAINST arguments overlap — shared themes, concession language, and bridge positions.',
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `Common Ground: ${stmt} · Lobby Market`,
      description: 'Nuanced arguments and shared vocabulary from both sides of the debate.',
    },
  }
}

export default async function CommonGroundPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <CommonGroundClient />
}
