import type { Metadata } from 'next'
import { TrajectoryClient } from './TrajectoryClient'

export const metadata: Metadata = {
  title: 'Civic Trajectory · Lobby Market',
  description:
    'Track the directional momentum of every active civic debate — which topics are surging FOR, reversing AGAINST, or stalling. See where opinion is moving before consensus hardens.',
  openGraph: {
    title: 'Civic Trajectory · Lobby Market',
    description:
      'Momentum vectors across all active debates — surging, reversing, oscillating. Where is civic opinion moving right now?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Trajectory · Lobby Market',
    description: 'Which debates are surging FOR, reversing AGAINST, or stalling? Track civic momentum in real time.',
  },
}

export default function TrajectoryPage() {
  return <TrajectoryClient />
}
