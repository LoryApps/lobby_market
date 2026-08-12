import type { Metadata } from 'next'
import { BreakthroughClient } from './BreakthroughClient'

export const metadata: Metadata = {
  title: 'Civic Breakthrough · Lobby Market',
  description:
    'Where democratic ambiguity becomes clarity — topics that have achieved decisive community consensus, ranked by agreement strength across four tiers: Forming, Clear, Landmark, and Unanimous.',
  openGraph: {
    title: 'Civic Breakthrough · Lobby Market',
    description:
      'The moments when civic debate produced a clear signal. See which topics have achieved landmark, unanimous, or clear consensus — and the direction the community chose.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Breakthrough · Lobby Market',
    description:
      'Democratic ambiguity resolved. Browse topics ranked by consensus strength — from emerging agreement to unanimous clarity.',
  },
}

export default function BreakthroughPage() {
  return <BreakthroughClient />
}
