import type { Metadata } from 'next'
import { CivicScoreLeaderboardClient } from './CivicScoreLeaderboardClient'

export const metadata: Metadata = {
  title: 'Civic Score Leaderboard · Lobby Market',
  description:
    'The most well-rounded civic participants on Lobby Market — ranked by a composite Civic Score across engagement breadth, argument quality, influence, and consistency.',
  openGraph: {
    title: 'Civic Score Leaderboard · Lobby Market',
    description:
      'Who truly leads the Lobby? A multi-dimensional ranking across engagement, quality, influence, and consistency — beyond just votes or clout.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Score Leaderboard · Lobby Market',
    description:
      'The most complete civic participants — ranked across engagement, argument quality, influence, and consistency.',
  },
}

export default function CivicScoreLeaderboardPage() {
  return <CivicScoreLeaderboardClient />
}
