import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WhatIfClient } from './WhatIfClient'

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

  if (!law) return { title: 'What If Repealed? · Lobby Market' }

  const againstPct = Math.round(100 - (law.blue_pct ?? 50))
  const dissenterCount = Math.round(((law.total_votes ?? 0) * againstPct) / 100)
  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''}`
  const title = `What If Repealed? ${short} · Lobby Market`
  const description =
    `${dissenterCount.toLocaleString()} citizens (${againstPct}%) opposed this law. ` +
    `Explore the civic cascade: which laws would be re-evaluated, which debates would resurface, ` +
    `and what the platform would look like if this consensus were overturned${law.category ? ` in ${law.category}` : ''}.`

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

export default async function LawWhatIfPage({ params }: Props) {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <WhatIfClient lawId={params.id} />
}
