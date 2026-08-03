import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawBreakdownClient } from './LawBreakdownClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Voter Breakdown · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 50)
  const stmt   = law.statement ?? ''
  const title  = `Voter Breakdown: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `How different voter cohorts lined up on this law — by role tier, Clout level, engagement type, and voting timing. Established with ${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter:   { card: 'summary', title, description },
    robots:    { index: false },
  }
}

export default async function LawBreakdownPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawBreakdownClient lawId={params.id} />
}
