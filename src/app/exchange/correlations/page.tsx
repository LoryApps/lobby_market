import type { Metadata } from 'next'
import { CorrelationsClient } from './CorrelationsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Correlations · Lobby Exchange',
  description:
    'Discover how civic prediction markets move together — or diverge. A Pearson correlation matrix across the top 20 markets by trading volume.',
  openGraph: {
    title: 'Market Correlations · Lobby Exchange',
    description:
      'Which civic debates rise and fall together? Explore the correlation matrix of the Lobby Exchange prediction markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Correlations · Lobby Exchange',
    description:
      'See which civic prediction markets move together and which diverge — the correlation matrix of Lobby Exchange.',
  },
}

export default function CorrelationsPage() {
  return <CorrelationsClient />
}
