import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScorecardClient } from './ScorecardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('title, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) return { title: 'Scorecard · Lobby Market' }

  const title = `Scorecard: ${debate.title ?? 'Untitled Debate'} · Lobby Market`
  const description = `Official point-by-point judging scorecard for this debate — argument volume, impact, quality, standout moments, and audience verdict.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function ScorecardPage({ params }: Props) {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) notFound()

  return <ScorecardClient debateId={debate.id} />
}
