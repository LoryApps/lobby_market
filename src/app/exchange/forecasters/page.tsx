import type { Metadata } from 'next'
import { ForecastersClient } from './ForecastersClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Price Forecasters · Lobby Market Exchange',
  description:
    'Leaderboard of the most accurate civic market price forecasters — ranked by prediction accuracy, direction hit rate, and composite score.',
  openGraph: {
    title: 'Price Forecasters · Lobby Market Exchange',
    description:
      'Who calls the civic markets best? Ranked by price accuracy and direction hit rate across all resolved markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Price Forecasters · Lobby Market Exchange',
    description: 'The most accurate price forecasters on civic prediction markets — ranked by call accuracy.',
  },
  robots: { index: false },
}

export default function ForecastersPage() {
  return <ForecastersClient />
}
