import type { Metadata } from 'next'
import { TimelineClient } from './TimelineClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Timeline · Lobby Exchange',
  description:
    'A real-time event stream of all civic prediction market activity — new markets, phase transitions, price milestones, near-law alerts, and high-volume bursts.',
  robots: { index: false },
  openGraph: {
    title: 'Market Timeline · Lobby Exchange',
    description: 'Live chronological feed of all exchange market events: new markets, laws, voting phases, price surges, and more.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Timeline · Lobby Exchange',
    description: 'Live event stream across all civic prediction markets.',
  },
}

export default function ExchangeTimelinePage() {
  return <TimelineClient />
}
