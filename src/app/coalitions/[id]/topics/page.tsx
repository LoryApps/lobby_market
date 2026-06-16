import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CoalitionTopicsClient } from './CoalitionTopicsClient'

interface Props {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: coalition } = await supabase
    .from('coalitions')
    .select('name, member_count, coalition_influence')
    .eq('id', params.id)
    .single()

  if (!coalition) return { title: 'Policy Positions · Lobby Market' }

  const title = `${coalition.name} · Policy Positions · Lobby Market`
  const description = `The official civic stances of ${coalition.name} — a ${coalition.member_count}-member coalition with ${Math.round(coalition.coalition_influence)} influence on Lobby Market.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export interface StanceWithTopic {
  id: string
  topic_id: string
  stance: 'for' | 'against' | 'neutral'
  statement: string | null
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface CoalitionSummary {
  id: string
  name: string
  member_count: number
  coalition_influence: number
}

export default async function CoalitionTopicsPage({ params }: Props) {
  const supabase = await createClient()

  const [coalitionRes, stancesRes] = await Promise.all([
    supabase
      .from('coalitions')
      .select('id, name, member_count, coalition_influence')
      .eq('id', params.id)
      .single(),
    supabase
      .from('coalition_stances')
      .select(`
        id,
        topic_id,
        stance,
        statement,
        created_at,
        topic:topics (
          id,
          statement,
          category,
          status,
          blue_pct,
          total_votes
        )
      `)
      .eq('coalition_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (coalitionRes.error || !coalitionRes.data) {
    notFound()
  }

  const coalition = coalitionRes.data as CoalitionSummary
  const stances = (stancesRes.data ?? []) as unknown as StanceWithTopic[]

  return (
    <CoalitionTopicsClient
      coalition={coalition}
      initialStances={stances}
    />
  )
}
