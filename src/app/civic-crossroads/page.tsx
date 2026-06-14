import type { Metadata } from 'next'
import { CivicCrossroadsClient } from './CivicCrossroadsClient'

export const metadata: Metadata = {
  title: 'Civic Crossroads · Lobby Market',
  description:
    'Every week, two fundamental civic values in direct tension. One vote. Where does the Lobby stand?',
  openGraph: {
    title: 'Civic Crossroads · Lobby Market',
    description:
      'Two values. One choice. Each week a new philosophical dilemma divides the Lobby — where do you stand?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Crossroads · Lobby Market',
    description: 'Weekly civic values dilemma — vote and see where the community stands.',
  },
}

export default function CivicCrossroadsPage() {
  return <CivicCrossroadsClient />
}
