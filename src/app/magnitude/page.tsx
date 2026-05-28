import type { Metadata } from 'next'
import { MagnitudeClient } from './MagnitudeClient'

export const metadata: Metadata = {
  title: 'Civic Magnitude · Lobby Market',
  description:
    'Topics ranked by their total democratic impact — a Richter scale for civic debate. Vote mass, consensus strength, and argument density combine into a single Magnitude score.',
  openGraph: {
    title: 'Civic Magnitude · Lobby Market',
    description:
      'Which civic debates left the biggest democratic footprint? Ranked by vote volume × consensus force × argument depth.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Magnitude · Lobby Market',
    description: 'A Richter scale for civic debate — topics ranked by their total democratic impact.',
  },
}

export default function MagnitudePage() {
  return <MagnitudeClient />
}
