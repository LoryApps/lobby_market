import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DebateMapClient } from './DebateMapClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  if (!topic) return { title: 'Debate Map' }

  return {
    title: `Debate Map — ${topic.statement}`,
    description: `Visual map of all arguments for and against: ${topic.statement}. See how arguments cluster by quality and position.`,
    openGraph: {
      title: `Debate Map — ${topic.statement}`,
      description: `Explore all arguments plotted as a 2D debate map.`,
    },
  }
}

export default async function DebateMapPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <DebateMapClient topicId={params.id} />
}
