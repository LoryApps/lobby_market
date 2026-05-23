import type { Metadata } from 'next'
import { AlignmentNetworkClient } from './AlignmentNetworkClient'

export const metadata: Metadata = {
  title: 'Civic Alignment Network · Lobby Market',
  description:
    'A visual map of your civic social graph — see how ideologically aligned each person in your network is with your voting positions. Discover echo chambers and ideological diversity at a glance.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Alignment Network · Lobby Market',
    description:
      'Visualise your civic network: who agrees with you, who challenges you, and whether you live in an echo chamber.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Alignment Network · Lobby Market',
    description: 'Your civic social graph — mapped by ideological alignment.',
  },
}

export default function AlignmentNetworkPage() {
  return <AlignmentNetworkClient />
}
