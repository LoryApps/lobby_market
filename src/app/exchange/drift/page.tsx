import type { Metadata } from 'next'
import { DriftClient } from './DriftClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Consensus Drift · Lobby Exchange',
  description:
    'Markets with sustained, consistent consensus movement over time — not sudden crossings, but steady drifts that compound day by day. Find the slow-movers before they become obvious.',
  robots: { index: false },
  openGraph: {
    title: 'Consensus Drift · Lobby Exchange',
    description:
      'Discover civic markets with steady, compounding consensus shifts. Unlike crossings or momentum, drift tracks sustained directional movement with high consistency.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Consensus Drift · Lobby Exchange',
    description:
      'Civic markets with sustained directional drift — slow movers with consistent, compounding consensus shifts.',
  },
}

export default function DriftPage() {
  return <DriftClient />
}
