import type { Metadata } from 'next'
import { PortfolioClient } from './PortfolioClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'My Portfolio · Lobby Exchange',
  description:
    'Track your civic market positions — entry prices, current consensus, and your total return across all topics you\'ve voted on.',
  robots: { index: false },
  openGraph: {
    title: 'My Portfolio · Lobby Exchange',
    description: 'Your personal civic market portfolio — positions, P&L, and win rate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function PortfolioPage() {
  return <PortfolioClient />
}
