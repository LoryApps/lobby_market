import type { Metadata } from 'next'
import { ClimateClient } from './ClimateClient'

export const metadata: Metadata = {
  title: 'Civic Climate · Lobby Market',
  description:
    'A live weather report for civic discourse — see which debates are stormy, where consensus is forming, and what\'s forecast to become law.',
  openGraph: {
    title: 'Civic Climate · Lobby Market',
    description:
      'Storm systems, clear skies, and forecasts — a meteorological view of civic debate across the platform. Where are debates raging? Where is consensus forming?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Climate · Lobby Market',
    description: 'A weather report for civic debate. Storm systems, clear skies, and what\'s forecast to become law.',
  },
}

export default function ClimatePage() {
  return <ClimateClient />
}
