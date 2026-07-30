import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SimilarLawsClient } from './SimilarLawsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export interface SourceLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  established_at: string
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Similar Laws · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Similar: ${short} · Lobby Market`
  const description =
    `Explore laws in the Codex related to "${stmt}" — other established consensus ` +
    `laws in the same category or sharing key themes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630, alt: stmt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function SimilarLawsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  const sourceLaw: SourceLaw = {
    id: law.id,
    statement: law.statement,
    category: law.category,
    total_votes: law.total_votes,
    established_at: law.established_at,
  }

  return <SimilarLawsClient lawId={params.id} sourceLaw={sourceLaw} />
}
