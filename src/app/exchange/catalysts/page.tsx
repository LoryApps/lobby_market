import type { Metadata } from 'next'
import { CatalystsClient } from './CatalystsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Catalysts · Lobby Exchange',
  description:
    'Discover which debates, arguments, and civic events historically drove the biggest price moves in Lobby Market prediction markets. Identify the signals before the market moves.',
  robots: { index: false },
  openGraph: {
    title: 'Market Catalysts · Lobby Exchange',
    description:
      'Which debates move markets? See the arguments, status changes, and debates that caused the biggest price swings across all civic prediction markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Catalysts · Lobby Exchange',
    description:
      'Debate-driven market intelligence — find the arguments and events that move civic prediction market prices.',
  },
}

export default function CatalystsPage() {
  return <CatalystsClient />
}
