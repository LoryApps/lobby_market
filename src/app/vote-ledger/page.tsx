import type { Metadata } from 'next'
import { VoteLedgerClient } from './VoteLedgerClient'

export const metadata: Metadata = {
  title: 'Vote Ledger · Lobby Market',
  description:
    'A transparent, real-time record of every vote cast on Lobby Market. Filter by side (For / Against) and time period to see how the platform votes.',
  openGraph: {
    title: 'Vote Ledger · Lobby Market',
    description:
      'Democratic accountability in action — browse every For and Against vote on Lobby Market, filterable by time period and position.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Vote Ledger · Lobby Market',
    description: 'A public, transparent record of every vote cast on Lobby Market.',
  },
}

export default function VoteLedgerPage() {
  return <VoteLedgerClient />
}
