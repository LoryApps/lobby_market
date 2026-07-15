import type { Metadata } from 'next'
import { MoversClient } from './MoversClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Movers · Lobby Exchange',
  description:
    'Top gainers, losers, and most volatile civic prediction markets in the last 24 hours — see where the consensus is shifting fastest.',
  robots: { index: false },
  openGraph: {
    title: 'Movers · Lobby Exchange',
    description: 'The fastest-moving civic markets: biggest gainers, deepest drops, and widest price swings in 24h.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Movers · Lobby Exchange',
    description: '24h price movers across all civic prediction markets — gainers, losers, and volatility leaders.',
  },
}

export default function MoversPage() {
  return <MoversClient />
}
