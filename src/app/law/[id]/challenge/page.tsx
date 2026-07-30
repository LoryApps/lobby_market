import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChallengeClient } from './ChallengeClient'

export const dynamic = 'force-dynamic'

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

  if (!law) return { title: 'Formal Challenge · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Challenge: ${short} · Lobby Market`
  const description =
    `File or support a formal challenge to this established law — constitutional, procedural, factual, ethical, or practical grounds. ` +
    `${(law.total_votes ?? 0).toLocaleString()} original votes${law.category ? ` · ${law.category}` : ''}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
    alternates: { canonical: `https://lobby.market/law/${params.id}/challenge` },
  }
}

export default async function LawChallengePage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <ChallengeClient lawId={params.id} />
}
