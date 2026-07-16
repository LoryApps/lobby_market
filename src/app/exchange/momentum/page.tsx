import type { Metadata } from 'next'
import { MomentumClient } from './MomentumClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Momentum Scanner · Lobby Exchange',
  description:
    'Track consensus acceleration across all civic prediction markets — see which debates are surging, falling, breaking out, or stalling in real time.',
  robots: { index: false },
  openGraph: {
    title: 'Momentum Scanner · Lobby Exchange',
    description:
      'Identify accelerating and decelerating civic consensus shifts before they become obvious. Breakouts, surges, and stalls — all in one view.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Momentum Scanner · Lobby Exchange',
    description: 'Track civic consensus acceleration: surging, falling, breakouts, and stalls.',
  },
}

export default function MomentumPage() {
  return <MomentumClient />
}
