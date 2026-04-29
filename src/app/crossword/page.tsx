import type { Metadata } from 'next'
import { CrosswordClient } from './CrosswordClient'

export const metadata: Metadata = {
  title: 'Civic Crossword · Lobby Market',
  description:
    'A daily mini-crossword with civic clues drawn from platform debates, laws, and community concepts. One new puzzle every day.',
  openGraph: {
    title: 'Civic Crossword · Lobby Market',
    description: 'Fill in today\'s civic mini-crossword — clues drawn from platform debates, laws, and democracy.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Crossword · Lobby Market',
    description: 'Daily civic crossword. New puzzle every day.',
  },
}

export default function CrosswordPage() {
  return <CrosswordClient />
}
