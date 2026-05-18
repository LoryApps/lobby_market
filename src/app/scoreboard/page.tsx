import type { Metadata } from 'next'
import { ScoreboardClient } from './ScoreboardClient'

export const metadata: Metadata = {
  title: 'Civic Scoreboard · Lobby Market',
  description:
    'Real-time leaderboard of civic impact — see which citizens, topics, and categories are generating the most heat right now.',
  openGraph: {
    title: 'Civic Scoreboard · Lobby Market',
    description:
      'Live civic impact rankings. Who is debating, voting, and shaping consensus right now on Lobby Market?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Scoreboard · Lobby Market',
    description: 'Real-time leaderboard — most active citizens, hottest topics, and category heat from the last hour.',
  },
}

export default function ScoreboardPage() {
  return <ScoreboardClient />
}
