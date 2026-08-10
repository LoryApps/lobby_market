import type { Metadata } from 'next'
import { ThreadsClient } from './ThreadsClient'

export const metadata: Metadata = {
  title: 'Civic Threads · Lobby Market',
  description:
    'Discover debate clusters grouped by theme — see every angle of a civic topic in one place. Browse #climate, #tax, #housing and hundreds more live debate threads.',
  openGraph: {
    title: 'Civic Threads · Lobby Market',
    description:
      'Every civic debate, grouped by theme. Browse active debate clusters — see how many debates are live, how the community is splitting, and which individual topics matter most.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Threads · Lobby Market',
    description:
      'Debate clusters by theme — browse #climate, #housing, #tax and more. See every angle of a civic topic at once.',
  },
}

export default function ThreadsPage() {
  return <ThreadsClient />
}
