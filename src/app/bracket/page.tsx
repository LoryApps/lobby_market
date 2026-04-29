import type { Metadata } from 'next'
import { BracketClient } from './BracketClient'

export const metadata: Metadata = {
  title: 'The Civic Bracket · Lobby Market',
  description:
    'March Madness for civic debates. Eight of the most contested topics compete head-to-head — vote to decide which one most deserves resolution this week.',
  openGraph: {
    title: 'The Civic Bracket · Lobby Market',
    description:
      'Vote through a single-elimination tournament of the Lobby\'s most contested topics. Crown this week\'s most urgent debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Bracket · Lobby Market',
    description: 'Which civic debate most deserves resolution? Vote your way through the bracket.',
  },
}

export default function BracketPage() {
  return <BracketClient />
}
