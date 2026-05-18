import type { Metadata } from 'next'
import { PollsClient } from './PollsClient'

export const metadata: Metadata = {
  title: 'Civic Quick Polls · Lobby Market',
  description:
    'Community quick polls on civic topics. Vote on questions your fellow citizens are asking — see live results and spark new conversations.',
  openGraph: {
    title: 'Civic Quick Polls · Lobby Market',
    description:
      'Fast, informal polls on any civic issue. Cast your vote and see how the community thinks in real time.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Quick Polls · Lobby Market',
    description: 'Community quick polls — vote and see live results.',
  },
}

export default function PollsPage() {
  return <PollsClient />
}
