import type { Metadata } from 'next'
import { ConvergingClient } from './ConvergingClient'

export const metadata: Metadata = {
  title: 'Civic Convergence · Lobby Market',
  description:
    'Debates building toward consensus — and ones where existing consensus is fracturing. Track which topics are heading for resolution and which are reversing back to deadlock.',
  openGraph: {
    title: 'Civic Convergence · Lobby Market',
    description:
      'Two forces shaping every debate: convergence (consensus building) and fracture (consensus challenged). See which debates are heading toward resolution right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Convergence · Lobby Market',
    description:
      'Which debates are building toward resolution — and which are fracturing back toward deadlock. Live consensus momentum tracking.',
  },
}

export default function ConvergingPage() {
  return <ConvergingClient />
}
