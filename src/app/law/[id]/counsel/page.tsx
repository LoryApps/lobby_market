import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawCounselClient } from './CounselClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Counsel · Lobby Market' }

  const title = `Counsel: ${law.statement.slice(0, 55)}${law.statement.length > 55 ? '…' : ''} · Lobby Market`
  const description = `AI analysis of this established law — origins, implications, amendment history, and real-world comparisons.`

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
  }
}

export default async function LawCounselPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawCounselClient />
}
