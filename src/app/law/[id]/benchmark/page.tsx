import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BenchmarkClient } from './BenchmarkClient'

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

  if (!law) return { title: 'Law Benchmark · Lobby Market' }

  const stmt = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(law.blue_pct ?? 50)
  const mandateStrength = Math.abs((law.blue_pct ?? 50) - 50) * 2

  const description =
    `How "${short}" stacks up against all ${law.category ?? 'established'} laws — ` +
    `${forPct}% FOR · ${(law.total_votes ?? 0).toLocaleString()} votes · ` +
    `${Math.round(mandateStrength)}% mandate strength. Percentile rankings, tier, and category peers.`

  return {
    title: `Benchmark: ${short} · Lobby Market`,
    description,
    openGraph: {
      title: `Benchmark: ${short} · Lobby Market`,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `Benchmark: ${short} · Lobby Market`,
      description,
    },
  }
}

export default async function LawBenchmarkPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!law) notFound()

  return <BenchmarkClient lawId={params.id} />
}
