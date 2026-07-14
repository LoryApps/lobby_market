import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BillDetail } from './BillDetail'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface BillPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: BillPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: bill } = await supabase
    .from('civic_bills')
    .select('short_title, long_title, category, stage, votes_for, votes_against')
    .eq('id', params.id)
    .single()

  if (!bill) {
    return { title: 'Bill · Lobby Market' }
  }

  const STAGE_LABELS: Record<string, string> = {
    first_reading:   'First Reading',
    second_reading:  'Second Reading',
    committee_stage: 'Committee Stage',
    report_stage:    'Report Stage',
    third_reading:   'Third Reading',
    lords:           'Lords Consideration',
    royal_assent:    'Royal Assent — Enacted',
    defeated:        'Defeated',
    withdrawn:       'Withdrawn',
  }

  const stageLabel = STAGE_LABELS[bill.stage] ?? bill.stage
  const total = bill.votes_for + bill.votes_against
  const forPct = total > 0 ? Math.round((bill.votes_for / total) * 100) : null

  const description = forPct !== null
    ? `${bill.long_title} — Currently at ${stageLabel}. ${forPct}% in favour (${total.toLocaleString()} votes cast).`
    : `${bill.long_title} — Currently at ${stageLabel}.`

  const title = `${bill.short_title} · Civic Bills · Lobby Market`

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

export default async function BillPage({ params }: BillPageProps) {
  const supabase = await createClient()

  const { data: bill } = await supabase
    .from('civic_bills')
    .select('id')
    .eq('id', params.id)
    .single()

  if (!bill) notFound()

  return <BillDetail billId={params.id} />
}
