import type { Metadata } from 'next'
import { LeaderboardClient } from './LeaderboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Group Leaderboard · Lobby Exchange',
  description:
    'The top-ranked public market groups on Lobby Exchange — curated civic prediction market baskets, ranked by volume, accuracy, and size.',
  robots: { index: false },
  openGraph: {
    title: 'Group Leaderboard · Lobby Exchange',
    description:
      'Discover the best public market groups — curated civic prediction market baskets ranked by volume and law rate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Group Leaderboard · Lobby Exchange',
    description: 'Top public civic market groups ranked by volume, accuracy, and size.',
  },
}

export default function GroupLeaderboardPage() {
  return <LeaderboardClient />
}
