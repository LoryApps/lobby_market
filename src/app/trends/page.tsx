import type { Metadata } from 'next'
import { TrendsClient } from './TrendsClient'

export const metadata: Metadata = {
  title: 'Civic Trends · Lobby Market',
  description:
    'What is the Lobby talking about right now? Track trending debates, rising categories, viral tags, and the voices driving civic conversation today.',
  openGraph: {
    title: 'Civic Trends · Lobby Market',
    description:
      'Real-time trending topics, categories, tags, and voices on Lobby Market — see where public opinion is moving right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Trends · Lobby Market',
    description: 'Track what the Lobby is debating right now — trending topics, categories, tags, and voices.',
  },
}

export default function TrendsPage() {
  return <TrendsClient />
}
