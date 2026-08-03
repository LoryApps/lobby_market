import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawCommonGroundClient } from './LawCommonGroundClient'

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

  if (!law) return { title: 'Common Ground · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 75)
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Common Ground: ${short} · Lobby Market`
  const description =
    `Where did both sides agree on "${stmt.slice(0, 80)}"? ` +
    `Discover arguments that bridged the divide, shared civic values invoked by FOR and AGAINST alike, ` +
    `and the common vocabulary that emerged from a debate that passed with ${forPct}% support.`

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
    alternates: { canonical: `https://lobby.market/law/${params.id}/common-ground` },
  }
}

export default async function LawCommonGroundPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <LawCommonGroundClient
      lawId={law.id}
      statement={law.statement}
      category={law.category ?? null}
      bluePct={law.blue_pct ?? 75}
      totalVotes={law.total_votes ?? 0}
      establishedAt={law.established_at ?? null}
    />
  )
}
