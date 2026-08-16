import type { Metadata } from 'next'
import { ForecastClient } from './ForecastClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Forecast · Lobby Market',
  description:
    'Predictive analytics for active civic debates — which topics are on track to become law, which are contested, and which are fading. Real-time law probability scores.',
  openGraph: {
    title: 'Civic Forecast · Lobby Market',
    description:
      'Live law probability scores for every active debate. See which topics are surging toward consensus and which are at risk of failing.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Forecast · Lobby Market',
    description:
      'Which debates will become law? Live probability forecasts for every active topic on Lobby Market.',
  },
}

export default function CivicForecastPage() {
  return <ForecastClient />
}
