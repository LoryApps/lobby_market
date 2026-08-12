import type { Metadata } from 'next'
import { CurrentClient } from './CurrentClient'

export const metadata: Metadata = {
  title: 'Civic Current · Lobby Market',
  description:
    'A vector-field view of every active debate — plotted by consensus direction and engagement depth, with arrows showing where opinion is moving and how fast. Like a weather map, but for democracy.',
  openGraph: {
    title: 'Civic Current · Lobby Market',
    description:
      'Every civic debate as an arrow on a map. Position = where opinion stands. Arrow direction = where it\'s drifting. Arrow length = speed of change. The flow field of democratic consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Current · Lobby Market',
    description:
      'A vector field of all debates — where they stand, where they\'re drifting, and how fast. Democracy as a weather map.',
  },
}

export default function CurrentPage() {
  return <CurrentClient />
}
