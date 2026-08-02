import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConvictionClient } from './ConvictionClient'

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

  if (!law) return { title: 'Conviction Atlas · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Conviction Atlas: ${short} · Lobby Market`
  const description =
    `How deeply did citizens believe in this law? Founding debate conviction scores, mandate strength, ` +
    `and the arguments that drove the ${forPct}% FOR consensus across ` +
    `${(law.total_votes ?? 0).toLocaleString()} votes${law.category ? ` in ${law.category}` : ''}.`

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
    },
  }
}

export default async function LawConvictionPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <ConvictionClient lawId={params.id} />
}
