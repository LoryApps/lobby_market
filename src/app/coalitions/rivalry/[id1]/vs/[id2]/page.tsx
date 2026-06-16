import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RivalryClient } from './RivalryClient'

interface Props {
  params: { id1: string; id2: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const [resA, resB] = await Promise.all([
    supabase.from('coalitions').select('name').eq('id', params.id1).single(),
    supabase.from('coalitions').select('name').eq('id', params.id2).single(),
  ])

  const nameA = resA.data?.name ?? 'Coalition A'
  const nameB = resB.data?.name ?? 'Coalition B'
  const title = `${nameA} vs ${nameB} · Rivalry · Lobby Market`
  const description = `Head-to-head record, stance alignment, and clash history between ${nameA} and ${nameB}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function RivalryPage({ params }: Props) {
  const { id1, id2 } = params

  if (!id1 || !id2 || id1 === id2) {
    notFound()
  }

  // Quick existence check — let the client handle loading/errors gracefully
  const supabase = await createClient()
  const [resA, resB] = await Promise.all([
    supabase.from('coalitions').select('id').eq('id', id1).single(),
    supabase.from('coalitions').select('id').eq('id', id2).single(),
  ])

  if (!resA.data || !resB.data) {
    notFound()
  }

  return <RivalryClient id1={id1} id2={id2} />
}
