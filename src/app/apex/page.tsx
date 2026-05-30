import type { Metadata } from 'next'
import { ApexClient } from './ApexClient'

export const metadata: Metadata = {
  title: 'The Civic Apex · Lobby Market',
  description:
    'All-time record holders for every civic category — the highest consensus, strongest dissent, most voted, most argued, and fastest laws on Lobby Market.',
  openGraph: {
    title: 'The Civic Apex · Lobby Market',
    description:
      'The peak civic achievements: per-category records for consensus, dissent, engagement, argumentation, and speed. Which topic reached the highest FOR%? Which became law fastest?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Apex · Lobby Market',
    description:
      'Record-breaking topics in every category — strongest consensus, deepest dissent, most votes, most arguments, fastest law.',
  },
}

export default function ApexPage() {
  return <ApexClient />
}
