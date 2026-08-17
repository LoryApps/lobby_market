import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VerdictCensusClient } from './VerdictCensusClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('title, status, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) return { title: 'Verdict Census · Lobby Market' }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement')
    .eq('id', debate.topic_id)
    .maybeSingle()

  const debateName = debate.title ?? topic?.statement ?? 'a debate'
  const short = debateName.slice(0, 55) + (debateName.length > 55 ? '…' : '')

  const title = `Verdict Census: ${short} · Lobby Market`
  const description =
    `Who declared each side the winner? Demographic breakdown of the post-debate audience poll — ` +
    `by seniority, civic role, clout, and voting activity.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/debate/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: false },
  }
}

export default async function DebateVerdictCensusPage({ params }: Props) {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) notFound()

  return <VerdictCensusClient debateId={debate.id} initialTitle={debate.title ?? null} />
}
