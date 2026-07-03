import type { Metadata } from 'next'
import { DrivesClient } from './DrivesClient'

export const metadata: Metadata = {
  title: 'Coalition Drives · Lobby Market',
  description:
    'Browse active coalition voting drives — coordinated campaigns where alliances rally members to vote together on key topics.',
  openGraph: {
    title: 'Coalition Drives · Lobby Market',
    description:
      'Track coordinated voting drives across every coalition on Lobby Market. See which alliances are rallying votes and on what topics.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Coalition Drives · Lobby Market',
    description: 'Active coalition voting campaigns across the Lobby.',
  },
}

export default function CoalitionDrivesPage() {
  return <DrivesClient />
}
