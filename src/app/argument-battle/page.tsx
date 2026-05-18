import type { Metadata } from 'next'
import { ArgumentBattleClient } from './ArgumentBattleClient'

export const metadata: Metadata = {
  title: 'Argument Battle · Lobby Market',
  description:
    "Today's 8 best arguments go head-to-head in a single-elimination bracket. Vote on which argument makes the stronger civic case — and crown the day's champion.",
  openGraph: {
    title: 'Argument Battle · Lobby Market',
    description:
      'The strongest arguments on Lobby Market compete in a daily bracket. Read, judge, and crown the champion.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Argument Battle · Lobby Market',
    description:
      "8 arguments enter, 1 argument wins. Vote your way through today's Argument Battle bracket.",
  },
}

export default function ArgumentBattlePage() {
  return <ArgumentBattleClient />
}
