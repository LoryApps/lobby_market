import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArgumentGraphView } from '@/components/topic/ArgumentGraphView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Argument Graph · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `${topic.statement} — Argument Graph · Lobby Market`
  const description = `Visual debate map: ${forPct}% For · ${(100 - forPct)}% Against · ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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

export default async function ArgumentGraphPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <div className="h-screen bg-surface-50 flex flex-col overflow-hidden">
      <ArgumentGraphView
        topicId={topic.id}
        initialTopic={{
          id: topic.id,
          statement: topic.statement,
          category: topic.category,
          blue_pct: topic.blue_pct ?? 50,
          total_votes: topic.total_votes ?? 0,
          status: topic.status,
        }}
      />
    </div>
  )
}
