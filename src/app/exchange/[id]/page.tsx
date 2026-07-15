import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { MarketDetailClient } from './MarketDetailClient'

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
      .select('statement, category, blue_pct, total_votes')
      .eq('id', params.id)
      .single()

    if (!data) {
      return { title: 'Market · Lobby Exchange' }
    }

    const price = Math.round(data.blue_pct ?? 50)
    const title = `${data.statement.slice(0, 60)} · ${price}¢ · Lobby Exchange`
    const description = `Currently trading at ${price}¢ with ${data.total_votes ?? 0} votes. ${
      data.category ? `Category: ${data.category}.` : ''
    } Trade the consensus on Lobby Market.`

    return {
      title,
      description,
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
  } catch {
    return { title: 'Market · Lobby Exchange' }
  }
}

export default function ExchangeMarketPage({ params }: Props) {
  return <MarketDetailClient id={params.id} />
}
