import type { Metadata } from 'next'
import { CohortClient } from './CohortClient'

export const metadata: Metadata = {
  title: 'Civic Tribe · Lobby Market',
  description:
    'Find your civic tribe — the users who think most like you. Discover who shares your votes, your values, and your civic vision across every debate.',
  openGraph: {
    title: 'Your Civic Tribe · Lobby Market',
    description:
      'See which citizens vote most like you across every debate on Lobby Market. These are your civic allies.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Tribe · Lobby Market',
    description: 'Find your civic allies — the voters who see the world through your eyes.',
  },
}

export default function CohortPage() {
  return <CohortClient />
}
