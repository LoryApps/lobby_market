import type { Metadata } from 'next'
import { RhythmClient } from './RhythmClient'

export const metadata: Metadata = {
  title: 'Civic Rhythm · Lobby Market',
  description:
    'When does democracy happen? A 7×24 temporal heatmap of platform activity — votes and arguments by day-of-week and hour-of-day. Discover the pulse pattern of civic engagement.',
  openGraph: {
    title: 'Civic Rhythm · Lobby Market',
    description:
      'When does the Lobby come alive? See the platform\'s weekly activity pattern — which hours and days see the most votes, the sharpest arguments, and the deepest deliberation.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Rhythm · Lobby Market',
    description: 'The temporal fingerprint of civic democracy — peak hours, quiet moments, and the best time to make your voice heard.',
  },
}

export default function RhythmPage() {
  return <RhythmClient />
}
