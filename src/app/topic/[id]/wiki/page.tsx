import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WikiPageClient } from './WikiPageClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes, description, description_updated_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Wiki · Lobby Market' }

  const stmt = topic.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Wiki: ${short} · Lobby Market`

  const hasContent = (topic.description ?? '').trim().length > 0
  const forPct = Math.round(topic.blue_pct ?? 50)

  const description = hasContent
    ? `${(topic.description as string).slice(0, 200).trim()}…`
    : `Community wiki for "${stmt}" — ${forPct}% For across ${(topic.total_votes ?? 0).toLocaleString()} votes. Contribute context, background, and analysis to this civic debate.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [
        {
          url: `/api/og/topic/${params.id}`,
          width: 1200,
          height: 630,
          alt: stmt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/topic/${params.id}`],
    },
    alternates: {
      canonical: `https://lobby.market/topic/${params.id}/wiki`,
    },
  }
}

export default async function TopicWikiPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <WikiPageClient topicId={params.id} />
}
