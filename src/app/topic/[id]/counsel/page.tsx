import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CounselClient } from './CounselClient'

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

  if (!topic) return { title: 'Topic Counsel · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement
  const short = stmt.length > 60 ? stmt.slice(0, 60) + '…' : stmt
  const title = `Counsel: ${short} · Lobby Market`
  const description =
    `Ask the AI Civic Counsel about this debate. ` +
    `${forPct}% FOR · ${100 - forPct}% AGAINST · ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast. ` +
    `Get a balanced analysis of both sides, strongest arguments, and real-world implications.`

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

export default async function TopicCounselPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <CounselClient />
}
