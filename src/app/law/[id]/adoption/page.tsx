import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdoptionClient } from './AdoptionClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Adoption · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(law.blue_pct ?? 50)
  const daysSince = law.established_at
    ? Math.floor((Date.now() - new Date(law.established_at).getTime()) / 86_400_000)
    : 0

  const title = `Adoption: ${short} · Lobby Market`
  const description =
    `${daysSince} days since passage. Track wiki stewardship, challenge pressure, amendment activity, ` +
    `and how well this law is being embraced by the community. ` +
    `Original consensus: ${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes.`

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
  }
}

export default async function LawAdoptionPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <AdoptionClient lawId={params.id} />
}
