import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { WordCloudView } from '@/components/topic/WordCloudView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Argument Vocabulary · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title  = `Argument Vocabulary — ${topic.statement} · Lobby Market`
  const description =
    `The most-used words in FOR (${forPct}%) and AGAINST (${100 - forPct}%) ` +
    `arguments for this debate. See what language shapes the civic conversation.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: { card: 'summary', title, description },
  }
}

export default async function WordCloudPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <WordCloudView
        topicId={topic.id}
        topicStatement={topic.statement}
        topicCategory={topic.category}
        backHref={`/topic/${topic.id}`}
      />
      <BottomNav />
    </div>
  )
}
