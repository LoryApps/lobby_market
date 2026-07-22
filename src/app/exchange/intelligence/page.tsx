import type { Metadata } from 'next'
import { IntelligenceClient } from './IntelligenceClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Intelligence · Lobby Exchange',
  description:
    'Cross-market signals for the Lobby Exchange — law watch, breakout detection, category rotation, quality divergence, and contrarian opportunities.',
  robots: { index: false },
  openGraph: {
    title: 'Market Intelligence · Lobby Exchange',
    description:
      'Daily intelligence brief for civic prediction markets: law watch, category rotation, breakout signals, and quality divergence — all in one read.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Intelligence · Lobby Exchange',
    description: 'Cross-market signals, law watch, and rotation analysis for the civic prediction exchange.',
  },
}

export default function IntelligencePage() {
  return <IntelligenceClient />
}
