import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicNotesPageClient } from './TopicNotesPageClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Topic Notes · Lobby Market' }

  const stmt = topic.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `My Notes: ${short} · Lobby Market`
  const description = 'Your private research notes and annotations for this civic debate.'

  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, type: 'website', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function TopicNotesPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <TopicNotesPageClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicCategory={topic.category}
      topicStatus={topic.status}
      bluePct={topic.blue_pct ?? 50}
    />
  )
}
