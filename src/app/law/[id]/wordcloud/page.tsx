import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LawWordCloudClient } from './LawWordCloudClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  if (!law) return { title: 'Argument Vocabulary · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Argument Vocabulary — ${law.statement} · Lobby Market`
  const description =
    `The most-used words in FOR (${forPct}%) and AGAINST (${100 - forPct}%) ` +
    `arguments that shaped this law. See what language the civic debate produced.`

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
    robots: { index: false },
  }
}

export default async function LawWordCloudPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <LawWordCloudClient
        topicId={law.topic_id ?? null}
        lawStatement={law.statement}
        lawCategory={law.category ?? null}
        backHref={`/law/${law.id}`}
      />
      <BottomNav />
    </div>
  )
}
