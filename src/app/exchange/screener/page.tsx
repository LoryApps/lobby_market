import type { Metadata } from 'next'
import { ScreenerClient } from './ScreenerClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Screener · Lobby Exchange',
  description:
    'Scan and filter all civic prediction markets by price, volume, momentum, category, and settlement date. Find the markets that match your strategy.',
  robots: { index: false },
  openGraph: {
    title: 'Market Screener · Lobby Exchange',
    description:
      'Multi-criteria scanner for civic prediction markets — filter by price range, volume, signals, category, and more.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Screener · Lobby Exchange',
    description: 'Scan all civic markets with advanced multi-criteria filters.',
  },
}

export default function ScreenerPage() {
  return <ScreenerClient />
}
