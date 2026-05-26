import type { Metadata } from 'next'
import { SeismicClient } from './SeismicClient'

export const metadata: Metadata = {
  title: 'Civic Seismic · Lobby Market',
  description:
    'Real-time anomaly detection for sudden vote bursts — which debates just experienced an unexpected spike? A Richter-scale rating for civic activity earthquakes.',
  openGraph: {
    title: 'Civic Seismic · Lobby Market',
    description:
      'When civic debate suddenly erupts, the Seismic monitor registers it. Track unexpected vote bursts, aftershocks, and rumbles across the platform in real time.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Seismic · Lobby Market',
    description: 'Detect sudden vote-burst anomalies in civic debate — rated on a 0–10 magnitude scale.',
  },
}

export default function SeismicPage() {
  return <SeismicClient />
}
