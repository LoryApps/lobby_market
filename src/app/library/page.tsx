import type { Metadata } from 'next'
import { LibraryClient } from './LibraryClient'

export const metadata: Metadata = {
  title: 'Civic Library · Lobby Market',
  description:
    'The best topic wikis, standout arguments, and established laws — curated for depth. Your reading room for civic knowledge on Lobby Market.',
  openGraph: {
    title: 'Civic Library · Lobby Market',
    description:
      'Browse the richest topic wikis, most-upvoted arguments, and all established laws. The intellectual core of the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Library · Lobby Market',
    description:
      'Top wikis, arguments, and laws — curated civic knowledge from the Lobby.',
  },
}

export default function LibraryPage() {
  return <LibraryClient />
}
