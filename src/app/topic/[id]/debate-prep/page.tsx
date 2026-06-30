import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DebatePrepClient } from './DebatePrepClient'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

interface Props {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Debate Prep · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt = topic.statement.slice(0, 70)

  return {
    title: `Debate Prep: ${stmt} · Lobby Market`,
    description: `Prepare your case for "${topic.statement}" — top arguments from both sides, supporting evidence, and tactical strategy. Current split: ${forPct}% FOR.`,
    openGraph: {
      title: `Debate Prep: ${stmt}`,
      description: `Study the strongest FOR and AGAINST arguments, evidence base, and strategic tips for this civic debate. Vote split: ${forPct}% FOR / ${100 - forPct}% AGAINST.`,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Debate Prep: ${stmt}`,
      description: `${forPct}% FOR · ${100 - forPct}% AGAINST · Prepare your case with the strongest community arguments.`,
    },
  }
}

export default async function DebatePrepPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .single()

  if (error || !topic) notFound()

  return (
    <>
      <TopBar />
      <DebatePrepClient topicId={params.id} />
      <BottomNav />
    </>
  )
}
