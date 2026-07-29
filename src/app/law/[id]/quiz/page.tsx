import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawQuizClient } from './LawQuizClient'

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

  if (!law) return { title: 'Law Quiz · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 60)
  const title = `Quiz: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Market`
  const description =
    `Test your knowledge of this established law — vote percentage, category, ` +
    `how long it took to pass, argument count, and more. ${forPct}% FOR · ${(law.total_votes ?? 0).toLocaleString()} votes cast.`

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

export default async function LawQuizPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawQuizClient lawId={params.id} />
}
