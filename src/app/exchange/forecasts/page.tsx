import type { Metadata } from 'next'
import { ForecastsClient } from './ForecastsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'My Forecasts · Lobby Exchange',
  description:
    'Track all your civic market price forecasts in one place — see how close your targets are to the current consensus, your direction accuracy, and overall forecasting score.',
  robots: { index: false },
  openGraph: {
    title: 'My Forecasts · Lobby Exchange',
    description: 'Your personal forecast tracker — targets, accuracy, and track record.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function ForecastsPage() {
  return <ForecastsClient />
}
