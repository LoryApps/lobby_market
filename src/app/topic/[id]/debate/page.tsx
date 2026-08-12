import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { DebateHubClient } from './DebateHubClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Debates · Lobby Market' }

  const stmt = topic.statement.slice(0, 70)
  const forPct = Math.round(topic.blue_pct ?? 50)

  return {
    title: `Debates: ${stmt} · Lobby Market`,
    description: `All debates scheduled and held for "${topic.statement}" — live events, upcoming clashes, and past outcomes. Current vote split: ${forPct}% FOR.`,
    openGraph: {
      title: `Debates: ${stmt}`,
      description: `Watch the civic debate live, RSVP for upcoming events, and review past outcomes. Vote split: ${forPct}% FOR / ${100 - forPct}% AGAINST.`,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Debates: ${stmt}`,
      description: `${forPct}% FOR · ${100 - forPct}% AGAINST · All debates on this topic.`,
    },
  }
}

export default async function TopicDebateHubPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic, error } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .single()

  if (error || !topic) notFound()

  return (
    <>
      <TopBar />
      <DebateHubClient topicId={params.id} />
      <BottomNav />
    </>
  )
}
