import type { Metadata } from 'next'
import { CountdownClient } from './CountdownClient'

export const metadata: Metadata = {
  title: 'Civic Countdown · Lobby Market',
  description:
    'Active civic votes ordered by time remaining — see which debates are closing soonest and cast your vote before the window closes.',
  openGraph: {
    title: 'Civic Countdown · Lobby Market',
    description:
      'Democracy on the clock. Vote on the debates closing soonest before the civic window shuts.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Countdown · Lobby Market',
    description:
      'Active civic votes ordered by time remaining. Vote before the window closes.',
  },
}

export default function CountdownPage() {
  return <CountdownClient />
}
