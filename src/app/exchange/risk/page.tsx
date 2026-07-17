import type { Metadata } from 'next'
import { RiskClient } from './RiskClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Risk Radar · Lobby Exchange',
  description:
    'Five-dimension portfolio risk analysis — concentration, resolution, momentum, liquidity, and drawdown risk for your civic market positions.',
  robots: { index: false },
  openGraph: {
    title: 'Risk Radar · Lobby Exchange',
    description:
      'Portfolio risk across five dimensions: concentration, resolution, momentum, liquidity, and drawdown.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function RiskPage() {
  return <RiskClient />
}
