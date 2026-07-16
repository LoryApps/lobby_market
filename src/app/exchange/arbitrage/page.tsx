import type { Metadata } from 'next'
import { ArbitrageClient } from './ArbitrageClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Arbitrage Scanner · Lobby Exchange',
  description:
    'Find markets where expert consensus diverges from the crowd. Large gaps between expert and crowd prices may signal mispriced civic debates.',
  openGraph: {
    title: 'Arbitrage Scanner · Lobby Exchange',
    description:
      'Discover where top-reputation traders disagree with the crowd — the civic prediction market\'s expert vs. crowd divergence tracker.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Arbitrage Scanner · Lobby Exchange',
    description: 'Expert vs. crowd divergence on civic prediction markets.',
  },
}

export default function ArbitragePage() {
  return <ArbitrageClient />
}
