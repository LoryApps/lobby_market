import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SwayClient } from './SwayClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: debate } = await supabase
    .from('debates')
    .select('title')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) return { title: 'Opinion Sway · Lobby Market' }

  const title = `Opinion Sway: ${debate.title ?? 'Untitled Debate'} · Lobby Market`
  const description =
    'Track how audience opinion shifted round-by-round — live sway arc, checkpoint sentiment, and net opinion swing.'

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function SwayPage({ params }: Props) {
  const supabase = await createClient()
  const { data: debate } = await supabase
    .from('debates')
    .select('id, title')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) notFound()

  return <SwayClient debateId={debate.id} debateTitle={debate.title} />
}
