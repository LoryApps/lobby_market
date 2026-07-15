import type { Metadata } from 'next'
import { LeaderboardClient } from './LeaderboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Prediction Leaderboard · Lobby Exchange',
  description:
    'The top civic market traders — ranked by win rate, portfolio return, and total volume. Who\'s the sharpest predictor on the Lobby?',
  openGraph: {
    title: 'Prediction Leaderboard · Lobby Exchange',
    description:
      'See who\'s winning on the civic prediction market. Top traders ranked by accuracy, return, and market volume.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Prediction Leaderboard · Lobby Exchange',
    description:
      'Top civic market traders ranked by win rate and portfolio performance.',
  },
}

export default function ExchangeLeaderboardPage() {
  return <LeaderboardClient />
}
