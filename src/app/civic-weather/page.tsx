import type { Metadata } from 'next'
import { CivicWeatherClient } from './CivicWeatherClient'

export const metadata: Metadata = {
  title: 'Civic Weather · Lobby Market',
  description:
    'The meteorological forecast for democracy — civic weather conditions across every policy domain. Temperature = consensus lean, Wind = debate intensity, Precipitation = polarisation.',
  openGraph: {
    title: 'Civic Weather · Lobby Market',
    description:
      'Is democracy running hot or cold? The Civic Weather maps platform sentiment to weather conditions — from Clear Skies (strong consensus) to Thunderstorm (maximum polarisation).',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Weather · Lobby Market',
    description:
      'Today\'s civic forecast: temperature, wind, and precipitation across 10 policy domains.',
  },
}

export default function CivicWeatherPage() {
  return <CivicWeatherClient />
}
