import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HighlightsClient } from './HighlightsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('title, status, topic_id')
    .eq('id', params.id)
    .single()

  if (!debate) return { title: 'Debate Highlights · Lobby Market' }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  const title = `Highlights: ${debate.title} · Lobby Market`
  const description = topic
    ? `The best arguments, sway moments, and top-voted messages from this debate on "${topic.statement}".`
    : 'Top arguments and key moments from this Lobby Market debate.'

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
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function HighlightsPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('id, status')
    .eq('id', params.id)
    .single()

  if (!debate) notFound()

  return <HighlightsClient debateId={params.id} />
}
