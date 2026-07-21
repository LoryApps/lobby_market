import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SteelmanClient } from './SteelmanClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('topics')
      .select('statement, category, blue_pct, total_votes, status')
      .eq('id', params.id)
      .single()

    if (!data) return { title: 'Steelman · Lobby Exchange' }

    const price = Math.round(data.blue_pct ?? 50)
    const stmt  = data.statement ?? ''
    const title = `Steelman: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Exchange`
    const description = `The strongest community arguments FOR and AGAINST this market at ${price}¢ — curated by upvotes, AI quality grade, and expert voices.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        siteName: 'Lobby Market',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    }
  } catch {
    return { title: 'Steelman · Lobby Exchange' }
  }
}

export default async function SteelmanPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <SteelmanClient marketId={params.id} statement={topic.statement} />
}
