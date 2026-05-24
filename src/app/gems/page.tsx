import type { Metadata } from 'next'
import { GemsClient } from './GemsClient'

export const metadata: Metadata = {
  title: 'Civic Gems · Lobby Market',
  description:
    'Hidden debates with real engagement, rising voices building their civic record, fresh arguments gaining traction, and laws that quietly changed the Codex — surface the underrated.',
  openGraph: {
    title: 'Civic Gems · Lobby Market',
    description:
      'Discover the underrated side of Lobby Market: hidden debates, rising voices, and overlooked laws worth your attention.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Gems · Lobby Market',
    description: 'Great civic content that deserves more attention — hidden debates, rising voices, quiet laws.',
  },
}

export default function GemsPage() {
  return <GemsClient />
}
