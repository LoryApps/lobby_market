import type { Metadata } from 'next'
import { HallOfFameClient } from './HallOfFameClient'

export const metadata: Metadata = {
  title: 'Hall of Fame · Civic Questions · Lobby Market',
  description:
    'The best minister Q&A exchanges ever recorded in the Lobby — ranked by community upvotes across every civic category.',
  openGraph: {
    title: 'Civic Q&A Hall of Fame · Lobby Market',
    description:
      'The most upvoted question-answer exchanges between citizens and Shadow Cabinet ministers. Westminster democracy at its finest.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Q&A Hall of Fame · Lobby Market',
    description: 'The sharpest questions and most celebrated minister answers in the Lobby.',
  },
}

export default function HallOfFamePage() {
  return <HallOfFameClient />
}
