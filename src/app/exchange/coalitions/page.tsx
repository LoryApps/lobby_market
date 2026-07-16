import type { Metadata } from 'next'
import { CoalitionsMarketClient } from './CoalitionsMarketClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Coalition Market Tracker · Lobby Exchange',
  description:
    'See how every coalition is positioned across civic markets — stance accuracy, bullish/bearish sentiment, and head-to-head win rates on resolved topics.',
  openGraph: {
    title: 'Coalition Market Tracker · Lobby Exchange',
    description:
      'Which coalition calls the market right? Track stance accuracy, active positions, and collective conviction across all civic prediction markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Coalition Market Tracker · Lobby Exchange',
    description: 'Coalition stance accuracy, active positions, and market conviction — all in one view.',
  },
}

export default function CoalitionsMarketPage() {
  return <CoalitionsMarketClient />
}
