import type { Metadata } from 'next'
import { PulseClient } from './PulseClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Pulse · Lobby Exchange',
  description:
    'Live vital signs for every civic prediction market — overall consensus health, category vitals, threshold watch, and the hottest markets right now.',
  robots: { index: false },
  openGraph: {
    title: 'Market Pulse · Lobby Exchange',
    description:
      'A live vital-signs dashboard for the civic exchange. See overall market health, category consensus, threshold crossings in progress, and the most active debates.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Pulse · Lobby Exchange',
    description: 'Live heartbeat of every civic prediction market — health, momentum, and thresholds at a glance.',
  },
}

export default function PulsePage() {
  return <PulseClient />
}
