import type { Metadata } from 'next'
import { HealthClient } from './HealthClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Health Monitor · Lobby Exchange',
  description:
    'Real-time health dashboard for Lobby Exchange markets — category coverage, thin markets, stale markets, and quality scores across the civic prediction platform.',
  robots: { index: false },
  openGraph: {
    title: 'Market Health Monitor · Lobby Exchange',
    description:
      'Track the health of civic prediction markets: participation rates, category coverage, thin markets, and stale debates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Health Monitor · Lobby Exchange',
    description: 'Exchange market health: coverage, participation, quality scores by category.',
  },
}

export default function HealthPage() {
  return <HealthClient />
}
