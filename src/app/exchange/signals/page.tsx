import type { Metadata } from 'next'
import { SignalsClient } from './SignalsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Signals · Lobby Exchange',
  description:
    'Pattern-based intelligence across all live civic prediction markets — near-consensus, momentum shifts, contested deadlocks, and volume breakouts in one view.',
  robots: { index: false },
  openGraph: {
    title: 'Market Signals · Lobby Exchange',
    description:
      'Curated signal patterns across live civic markets: near-law thresholds, 24h momentum, contested deadlocks, and high-volume breakouts.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Signals · Lobby Exchange',
    description: 'Pattern-based civic market intelligence — near-consensus, momentum, and contested deadlocks.',
  },
}

export default function SignalsPage() {
  return <SignalsClient />
}
