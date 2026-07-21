import type { Metadata } from 'next'
import { ActivityClient } from './ActivityClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Live Activity · Lobby Exchange',
  description:
    'Real-time stream of all trades, arguments, and price crossings across the Lobby Exchange. See the market pulse as it happens.',
  robots: { index: false },
  openGraph: {
    title: 'Live Activity · Lobby Exchange',
    description:
      'Live feed of every trade, argument posted, and threshold crossing across all civic prediction markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Live Activity · Lobby Exchange',
    description: 'Real-time pulse of the Civic Exchange — trades, arguments, and price crossings.',
  },
}

export default function ActivityPage() {
  return <ActivityClient />
}
