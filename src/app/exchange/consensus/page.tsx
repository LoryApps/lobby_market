import type { Metadata } from 'next'
import { ConsensusClient } from './ConsensusClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Crowd Consensus · Lobby Exchange',
  description:
    'Where is the crowd sending civic prediction markets? Aggregate price forecasts vs. current consensus — see which markets the crowd thinks are underpriced or overpriced.',
  robots: { index: false },
  openGraph: {
    title: 'Crowd Consensus · Lobby Exchange',
    description:
      'Aggregated crowd price forecasts for every civic market. Spot the divergences — where does the community think the market is wrong?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Crowd Consensus · Lobby Exchange',
    description:
      'Community forecast aggregation — see which civic markets the crowd thinks will move up or down.',
  },
}

export default function ConsensusPage() {
  return <ConsensusClient />
}
