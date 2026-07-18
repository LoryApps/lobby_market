import type { Metadata } from 'next'
import { IdeasLeaderboardClient } from './IdeasLeaderboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Thesis Leaderboard · Lobby Exchange',
  description:
    'Top market idea authors ranked by community score — see who makes the most accurate and insightful civic market predictions.',
  robots: { index: false },
  openGraph: {
    title: 'Thesis Leaderboard · Lobby Exchange',
    description:
      'The best civic market prediction authors ranked by community upvotes, net score, and idea volume.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Thesis Leaderboard · Lobby Exchange',
    description: 'Top prediction thesis authors on the Civic Exchange — ranked by community score.',
  },
}

export default function IdeasLeaderboardPage() {
  return <IdeasLeaderboardClient />
}
