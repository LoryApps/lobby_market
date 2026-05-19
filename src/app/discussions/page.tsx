import type { Metadata } from 'next'
import { DiscussionsClient } from './DiscussionsClient'

export const metadata: Metadata = {
  title: 'Active Discussions · Lobby Market',
  description:
    'The most active argument threads on Lobby Market — ranked by reply count, recency, and engagement. Join the conversation where civic debate is hottest.',
  openGraph: {
    title: 'Active Discussions · Lobby Market',
    description:
      'Discover where the debate is happening. Arguments with the most active reply threads, across every civic topic and category.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Active Discussions · Lobby Market',
    description: 'The most replied-to arguments on the platform — filter by category, side, and time.',
  },
}

export default function DiscussionsPage() {
  return <DiscussionsClient />
}
