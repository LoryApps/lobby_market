import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketIdeasClient } from './MarketIdeasClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('topics')
    .select('statement, blue_pct')
    .eq('id', id)
    .single()
  if (!data) return { title: 'Market Ideas · Lobby Exchange' }
  const price = Math.round(data.blue_pct ?? 50)
  return {
    title: `Ideas: ${data.statement.slice(0, 55)} · ${price}¢ · Lobby Exchange`,
    description: `Community prediction theses for this civic market. Share your thesis, target price, and confidence.`,
    robots: { index: false },
  }
}

export default async function MarketIdeasPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, status')
    .eq('id', id)
    .maybeSingle()
  if (!topic) notFound()
  return (
    <MarketIdeasClient
      topicId={topic.id}
      topicStatement={topic.statement}
      topicPrice={Math.round(topic.blue_pct ?? 50)}
      topicStatus={topic.status}
    />
  )
}
