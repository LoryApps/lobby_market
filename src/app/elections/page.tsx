import type { Metadata } from 'next'
import { ElectionsClient } from './ElectionsClient'

export const metadata: Metadata = {
  title: 'Civic Elections · Lobby Market',
  description:
    'Vote for community representatives in the Lobby Senate, Troll Catcher Council, and Elder Circle. Monthly elections decide who guides the platform.',
  openGraph: {
    title: 'Civic Elections · Lobby Market',
    description:
      'Democracy in action — elect your platform representatives. Senators, Troll Catchers, and Elders are chosen by the community, for the community.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Elections · Lobby Market',
    description: 'Vote for your civic representatives on Lobby Market.',
  },
}

export default function ElectionsPage() {
  return <ElectionsClient />
}
