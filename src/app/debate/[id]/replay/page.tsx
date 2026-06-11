import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReplayClient } from './ReplayClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: debate } = await supabase
    .from('debates')
    .select('title, type')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) return { title: 'Debate Replay · Lobby Market' }

  const title = `Replay: ${debate.title} · Lobby Market`
  const description = `Watch this debate play out argument by argument — an animated replay of the full discussion, message by message.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    robots: { index: false },
  }
}

export default async function DebateReplayPage({ params }: Props) {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate || debate.status !== 'ended') notFound()

  return <ReplayClient debateId={params.id} debateTitle={debate.title} />
}
