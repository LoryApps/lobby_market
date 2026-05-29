import type { Metadata } from 'next'
import { BlindSpotsClient } from './BlindSpotsClient'

export const metadata: Metadata = {
  title: 'Civic Blind Spots · Lobby Market',
  description:
    'Discover the civic categories you\'ve never engaged with — and challenge yourself to expand your democratic participation beyond your comfort zone.',
  openGraph: {
    title: 'Civic Blind Spots · Lobby Market',
    description:
      'Which civic debates have you been ignoring? See your coverage across all 10 civic categories and get personalized challenges to broaden your perspective.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Blind Spots · Lobby Market',
    description:
      'Find the civic debates you\'ve been missing — and break out of your engagement bubble.',
  },
}

export default function BlindSpotsPage() {
  return <BlindSpotsClient />
}
