import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CompareTopicsClient } from './CompareTopicsClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Compare Topics · Lobby Market' }

  return {
    title: `Compare: ${topic.statement.slice(0, 60)} · Lobby Market`,
    description: `Compare this debate side-by-side with another topic — vote splits, consensus strength, arguments, and more.`,
    openGraph: {
      title: `Compare: ${topic.statement.slice(0, 60)} · Lobby Market`,
      description: 'Side-by-side topic comparison — consensus, votes, arguments, debates.',
      type: 'article',
      siteName: 'Lobby Market',
    },
  }
}

export default async function TopicComparePage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <Suspense>
      <CompareTopicsClient primaryId={params.id} />
    </Suspense>
  )
}
