import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MomentumClient } from './MomentumClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Momentum · Lobby Exchange' }

  const price = Math.round((topic.blue_pct as number) ?? 50)
  const stmt = (topic.statement as string) ?? ''
  const title = `Momentum: ${stmt.slice(0, 50)}${stmt.length > 50 ? '…' : ''} · Lobby Exchange`
  const description =
    `Price velocity, acceleration, volume growth and argument momentum for this civic market. ` +
    `Current consensus: ${price}¢. Identify breakouts, reversals, and accumulation phases.`

  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function MarketMomentumPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <MomentumClient />
}
