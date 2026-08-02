import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OriginsClient } from './OriginsClient'

export const dynamic = 'force-dynamic'

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

  if (!law) return { title: 'Law Origins · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const forPct = Math.round(law.blue_pct ?? 50)
  const year = new Date(law.established_at).getFullYear()
  const title = `Origins: ${stmt.slice(0, 52)}${stmt.length > 52 ? '…' : ''} · Lobby Market`
  const description =
    `Trace the founding story of this established law — who proposed it, how it evolved from debate to consensus, ` +
    `and the pioneer voters who shaped its passage. Passed ${year} with ${forPct}% FOR.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [
        {
          url: `/api/og/law/${params.id}`,
          width: 1200,
          height: 630,
          alt: stmt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
    robots: { index: true },
  }
}

export default async function LawOriginsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <OriginsClient lawId={params.id} />
}
