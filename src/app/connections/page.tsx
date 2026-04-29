import type { Metadata } from 'next'
import { ConnectionsClient } from './ConnectionsClient'

export const metadata: Metadata = {
  title: 'Civic Connections · Lobby Market',
  description:
    'Group 16 civic terms into 4 categories. A daily word-grouping puzzle for civic minds — yellow is easiest, purple is hardest.',
  openGraph: {
    title: 'Civic Connections · Lobby Market',
    description: 'Can you find the hidden links between 16 civic terms? A new puzzle every day.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Connections · Lobby Market',
    description: 'Daily civic word-grouping puzzle. Group 4 terms that share a connection.',
  },
}

export default function ConnectionsPage() {
  return <ConnectionsClient />
}
