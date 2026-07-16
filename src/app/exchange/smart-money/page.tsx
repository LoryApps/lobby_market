import type { Metadata } from 'next'
import { SmartMoneyClient } from './SmartMoneyClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Smart Money · Lobby Exchange',
  description:
    'See where high-accuracy civic traders are positioning — consensus signals, win rates, and active positions from the platform\'s top predictors.',
  robots: { index: false },
  openGraph: {
    title: 'Smart Money · Lobby Exchange',
    description:
      'Track high-accuracy traders and consensus signals across live civic prediction markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Smart Money · Lobby Exchange',
    description:
      'Where top civic traders are positioning — signals, win rates, and active positions.',
  },
}

export default function SmartMoneyPage() {
  return <SmartMoneyClient />
}
