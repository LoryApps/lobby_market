import type { Metadata } from 'next'
import { TransparencyClient } from './TransparencyClient'

export const metadata: Metadata = {
  title: 'Transparency Report · Lobby Market',
  description:
    'Real-time platform health and governance statistics — total citizens, votes cast, laws established, category breakdowns, community roles, and platform milestones.',
  openGraph: {
    title: 'Transparency Report · Lobby Market',
    description:
      'See exactly how the Lobby is working: participation, consensus, governance, and growth — no hidden metrics, no spin.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Transparency Report · Lobby Market',
    description:
      'Platform health stats: citizens, votes, laws, debates, coalitions — open and real-time.',
  },
}

export default function TransparencyPage() {
  return <TransparencyClient />
}
