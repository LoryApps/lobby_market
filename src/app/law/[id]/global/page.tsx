import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GlobalClient } from './GlobalClient'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

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

  if (!law) return { title: 'Global Context · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 50)
  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''}`
  const title = `Global Context: ${short} · Lobby Market`
  const description =
    `How does ${forPct}% civic consensus on this ${law.category ?? 'topic'} compare to real-world international policy positions? ` +
    `See where Lobby Market's community consensus sits on a global political spectrum, ` +
    `with peer laws from across the Codex for comparison.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630, alt: stmt }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [`/api/og/law/${params.id}`] },
  }
}

export default async function LawGlobalPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <GlobalClient lawId={params.id} />
}
