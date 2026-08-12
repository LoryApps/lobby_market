import type { Metadata } from 'next'
import { GoalsClient } from './GoalsClient'

export const metadata: Metadata = {
  title: 'Civic Goals · Lobby Market',
  description:
    'Your weekly civic targets — votes, arguments, debates, streak, and influence. Track your progress and hit your goals to earn Clout bonuses.',
  openGraph: {
    title: 'Civic Goals · Lobby Market',
    description:
      'Set and track weekly civic goals on Lobby Market. Votes, arguments, debates — every action counts toward your civic mission.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Goals · Lobby Market',
    description: 'Your weekly civic targets — track progress, earn bonuses, build the habit.',
  },
}

export default function GoalsPage() {
  return <GoalsClient />
}
