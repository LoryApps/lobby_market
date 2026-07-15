import type { Metadata } from 'next'
import { ExchangeClient } from './ExchangeClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Exchange · Lobby Market',
  description:
    'Real-time prediction market for civic consensus — every debate is a contract, every vote moves the price. Track live markets, volume, and momentum.',
  openGraph: {
    title: 'Civic Exchange · Lobby Market',
    description:
      'Trade the consensus. Every civic debate listed as a live prediction market — price, volume, and settlement in one view.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Exchange · Lobby Market',
    description:
      'Live prediction markets for civic consensus. Watch every debate as a contract, see prices move in real time.',
  },
}

export default function ExchangePage() {
  return <ExchangeClient />
}
