import type { Metadata } from 'next'
import { CivicImpactClient } from './CivicImpactClient'

export const metadata: Metadata = {
  title: 'Civic Impact Score · Lobby Market',
  description:
    'Your composite Civic Impact Score — a single number that captures your voting power, argument strength, debate record, law-making influence, and community reach on Lobby Market.',
  robots: { index: false },
  openGraph: {
    title: 'Civic Impact Score · Lobby Market',
    description:
      'How much civic impact are you making? One number that combines votes, arguments, debates, laws, and community — your Civic Impact Score.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Impact Score · Lobby Market',
    description: 'Your composite civic influence: votes, arguments, debates, laws, community — in one score.',
  },
}

export default function CivicImpactPage() {
  return <CivicImpactClient />
}
