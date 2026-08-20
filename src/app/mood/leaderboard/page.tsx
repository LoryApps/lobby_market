import type { Metadata } from 'next'
import { MoodLeaderboardClient } from './MoodLeaderboardClient'

export const metadata: Metadata = {
  title: 'Mood Leaderboard · Lobby Market',
  description:
    'Which civic debates stir the strongest emotions? See topics ranked by total mood expressions — hopeful, inspired, worried, angry — and filter by how the platform is feeling.',
  openGraph: {
    title: 'Mood Leaderboard · Lobby Market',
    description:
      'The most emotionally engaging civic debates on Lobby Market. Ranked by how many people expressed a mood — and which emotion dominates each debate.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Mood Leaderboard · Lobby Market',
    description:
      'Which debates make people most hopeful? Most worried? Most angry? The civic mood leaderboard reveals it all.',
  },
}

export default function MoodLeaderboardPage() {
  return <MoodLeaderboardClient />
}
