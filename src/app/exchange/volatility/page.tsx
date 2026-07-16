import type { Metadata } from 'next'
import { VolatilityClient } from './VolatilityClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Volatility · Lobby Exchange',
  description:
    'Identify the most volatile and most stable civic prediction markets — track price variance, choppiness, and trend strength across every debate.',
  robots: { index: false },
  openGraph: {
    title: 'Market Volatility · Lobby Exchange',
    description:
      'Price variance and stability rankings across civic prediction markets. Which debates are the most contested — and which have already found consensus?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Volatility · Lobby Exchange',
    description:
      'Rank markets by price variance and choppiness — find the debates where consensus is still up for grabs.',
  },
}

export default function VolatilityPage() {
  return <VolatilityClient />
}
