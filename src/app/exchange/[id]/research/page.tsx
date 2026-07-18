import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResearchClient } from './ResearchClient'

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

  if (!topic) return { title: 'Market Research · Lobby Exchange' }

  const price = Math.round(topic.blue_pct ?? 50)
  const title = `${topic.statement} — Research Report`
  const description = `Market intelligence report: current price ${price}¢, ${topic.total_votes?.toLocaleString() ?? 0} votes. Forecasts, arguments, theses and commentary.`

  return {
    title: `${title} · Lobby Exchange`,
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

export default async function ResearchPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <ResearchClient id={params.id} statement={topic.statement} />
}
