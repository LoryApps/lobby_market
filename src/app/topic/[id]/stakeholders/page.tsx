import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StakeholdersClient } from './StakeholdersClient'

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

  if (!topic) return { title: 'Stakeholder Map · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Stakeholder Map: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Who has a stake in this debate? See which groups are affected, ` +
    `their power level, and whether they stand to gain or lose — ` +
    `currently ${forPct}% FOR across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
    robots: { index: false },
  }
}

export default async function StakeholdersPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <StakeholdersClient topicId={params.id} />
}
