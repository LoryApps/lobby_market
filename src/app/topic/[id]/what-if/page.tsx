import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WhatIfClient } from './WhatIfClient'

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

  if (!topic) return { title: 'What If? · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `What If? ${topic.statement.slice(0, 55)} · Lobby Market`
  const description = `Scenario lab: explore the civic ripple effects if this debate passes (${forPct}% FOR) or fails (${100 - forPct}% AGAINST). See which correlated debates shift, which chains unlock, and how the platform consensus moves.`

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

export default async function WhatIfPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <WhatIfClient topicId={params.id} />
}
