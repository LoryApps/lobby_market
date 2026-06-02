import type { Metadata } from 'next'
import { SchismClient } from './SchismClient'

export const metadata: Metadata = {
  title: 'The Civic Schism · Lobby Market',
  description:
    'The deepest ideological fault lines on Lobby Market — topics where both sides don\'t just vote differently, they argue differently. Ranked by vote polarization, argument balance, and debate depth.',
  openGraph: {
    title: 'The Civic Schism · Lobby Market',
    description:
      'Where consensus is impossible: the debates with the most balanced FOR and AGAINST arguments and near-perfect vote deadlocks. These are the issues that genuinely divide us.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Schism · Lobby Market',
    description: 'The platform\'s deepest fault lines — 50/50 votes, balanced arguments, both sides refusing to yield.',
  },
}

export default function SchismPage() {
  return <SchismClient />
}
