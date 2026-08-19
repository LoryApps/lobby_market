import type { Metadata } from 'next'
import { ProgressClient } from './ProgressClient'

export const metadata: Metadata = {
  title: 'Civic Progress · Lobby Market',
  description:
    'Track how far the Lobby has come — votes cast, laws established, debates held, and the civic milestones reached along the way.',
  openGraph: {
    title: 'Civic Progress · Lobby Market',
    description:
      'Every vote, argument, and law is a step forward. See the milestones the Lobby has crossed — and what comes next.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Progress · Lobby Market',
    description:
      'Platform milestones, category growth, and civic achievements. The Lobby\'s journey in numbers.',
  },
}

export default function ProgressPage() {
  return <ProgressClient />
}
