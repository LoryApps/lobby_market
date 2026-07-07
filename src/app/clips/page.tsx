import type { Metadata } from 'next'
import { ClipsClient } from './ClipsClient'

export const metadata: Metadata = {
  title: 'Civic Clips · Lobby Market',
  description:
    'Swipe through the sharpest arguments on the platform — top-voted, AI-scored civic takes from every corner of the debate.',
  openGraph: {
    title: 'Civic Clips · Lobby Market',
    description:
      'The best arguments on Lobby Market — one card at a time. Swipe, upvote, and reply.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Clips · Lobby Market',
    description: 'Swipe through the sharpest civic arguments on the platform.',
  },
}

export default function ClipsPage() {
  return <ClipsClient />
}
