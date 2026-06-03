import type { Metadata } from 'next'
import { ElectionsClient } from './ElectionsClient'

export const metadata: Metadata = {
  title: 'Civic Elections · Lobby Market',
  description:
    'Monthly democratic elections for platform council roles. Nominate yourself, campaign with a statement, and vote for the citizens who should represent the Lobby.',
  openGraph: {
    title: 'Civic Elections · Lobby Market',
    description:
      'Vote for Senators, Troll Catchers, and Elders in monthly democratic elections. The Lobby governs itself.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Elections · Lobby Market',
    description: 'Monthly council elections — nominate, campaign, vote. The Lobby governs itself.',
  },
}

export default function CivicElectionsPage() {
  return <ElectionsClient />
}
