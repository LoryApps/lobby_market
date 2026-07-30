import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawParallelsClient } from './LawParallelsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Global Legal Precedents · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Global Precedents: ${short} · Lobby Market`
  const description =
    `How do similar laws from around the world compare to this established consensus? ` +
    `See implementation outcomes, public acceptance, amendment histories, and key lessons from ${law.category ? `${law.category} laws` : 'comparable legislation'} across multiple jurisdictions. ` +
    `${(law.total_votes ?? 0).toLocaleString()} votes in the original debate.`

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
      canonical: `https://lobby.market/law/${params.id}/parallels`,
    },
  }
}

export default async function LawParallelsPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawParallelsClient lawId={params.id} />
}
