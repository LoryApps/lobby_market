import type { Metadata } from 'next'
import { LedgerClient } from './LedgerClient'

export const metadata: Metadata = {
  title: 'The Civic Ledger · Lobby Market',
  description:
    'The official chronological record of every civic decision on Lobby Market — every law established and every proposal that failed, in order.',
  openGraph: {
    title: 'The Civic Ledger · Lobby Market',
    description:
      'An immutable record of democracy in action: every topic that became law, every proposal that failed — with final vote percentages, dates, and the full decision history of the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Ledger · Lobby Market',
    description: 'Every civic decision ever made on Lobby Market — laws and failures, in chronological order.',
  },
}

export default function LedgerPage() {
  return <LedgerClient />
}
