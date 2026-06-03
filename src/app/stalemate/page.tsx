import type { Metadata } from 'next'
import { StalemateClient } from './StalemateClient'

export const metadata: Metadata = {
  title: 'The Civic Stalemate · Lobby Market',
  description:
    'Which civic debates are in perfect democratic deadlock? The Stalemate tracks topics where FOR and AGAINST forces are equally matched — locked in gridlock with no side able to break through.',
  openGraph: {
    title: 'The Civic Stalemate · Lobby Market',
    description:
      'Chess has zugzwang. Democracy has the stalemate. These are the civic debates where both sides are so perfectly matched that neither can gain ground — locked at 50/50, equally armed with arguments, waiting for a tiebreaker.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Stalemate · Lobby Market',
    description:
      'Perfect democratic deadlock — topics where FOR and AGAINST are so evenly matched that neither side can advance. The frozen wars of civic debate.',
  },
}

export default function StalemagePage() {
  return <StalemateClient />
}
