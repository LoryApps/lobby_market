import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BlocsClient } from './BlocsClient'

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

  if (!law) return { title: 'Voting Blocs · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Voting Blocs: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `How different civic roles, clout tiers, and coalitions voted on this law — ` +
    `${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes. ` +
    `See whether Lawmakers, Elders, and Debaters agreed with the final verdict.`

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
    alternates: {
      canonical: `https://lobby.market/law/${params.id}/blocs`,
    },
  }
}

export default async function LawBlocsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <BlocsClient
      lawId={law.id}
      statement={law.statement ?? ''}
      category={law.category ?? null}
    />
  )
}
