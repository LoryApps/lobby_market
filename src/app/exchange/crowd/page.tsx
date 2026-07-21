import type { Metadata } from 'next'
import { CrowdGlobalClient } from './CrowdGlobalClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Crowd vs Market · Lobby Exchange',
  description:
    'Where collective predictions diverge from live consensus — see which markets the crowd is more bullish or bearish on than the current price, and track platform-wide forecasting accuracy.',
  robots: { index: false },
  openGraph: {
    title: 'Crowd vs Market · Lobby Exchange',
    description:
      'Platform-wide crowd intelligence — which markets have the biggest gap between predictions and prices. Smart money vs retail accuracy, Brier scores, and divergence rankings.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Crowd vs Market · Lobby Exchange',
    description: 'Where crowd predictions diverge most from live market prices.',
  },
}

export default function CrowdGlobalPage() {
  return <CrowdGlobalClient />
}
