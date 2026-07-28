import type { Metadata } from 'next'
import { RivalsClient } from './RivalsClient'

export const metadata: Metadata = {
  title: 'Civic Rivals · Lobby Market',
  description:
    'Find citizens who voted most differently from you. Discover your arch-nemeses on key policy debates.',
  openGraph: {
    title: 'Civic Rivals · Lobby Market',
    description:
      'Find citizens who voted most differently from you. Discover your arch-nemeses on key policy debates.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Rivals · Lobby Market',
    description:
      'Find citizens who voted most differently from you. Discover your arch-nemeses on key policy debates.',
  },
}

export default function CivicRivalsPage() {
  return <RivalsClient />
}
