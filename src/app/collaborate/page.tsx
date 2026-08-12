import type { Metadata } from 'next'
import { CollaborateClient } from './CollaborateClient'

export const metadata: Metadata = {
  title: 'Collaborate · Lobby Market',
  description:
    'Find your next civic contribution — open debates to join, topics needing arguments, coalitions recruiting, and relay chains to continue.',
  openGraph: {
    title: 'Collaborate · Lobby Market',
    description:
      'Discover where your voice is needed most. Join open debates, write arguments for contested topics, and build coalitions with like-minded citizens.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Collaborate · Lobby Market',
    description:
      'Find where to contribute — debates, arguments, coalitions, and relays waiting for you.',
  },
}

export default function CollaboratePage() {
  return <CollaborateClient />
}
