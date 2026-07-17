import type { Metadata } from 'next'
import { StrategyClient } from './StrategyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Strategy Monitor · Lobby Exchange',
  description:
    'Apply your prediction strategy to live civic markets. See which active topics your strategy signals right now — with entry price, current price, and unrealized P&L for every position.',
  robots: { index: false },
  openGraph: {
    title: 'Strategy Monitor · Lobby Exchange',
    description:
      'Live signals from your configured prediction strategy — entry price, current price, and unrealized P&L across all active civic markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Strategy Monitor · Lobby Exchange',
    description: 'See which active markets your strategy signals right now. Live unrealized P&L for every position.',
  },
}

export default function StrategyPage() {
  return <StrategyClient />
}
