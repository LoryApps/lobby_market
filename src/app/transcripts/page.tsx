import type { Metadata } from 'next'
import { TranscriptsClient } from './TranscriptsClient'

export const metadata: Metadata = {
  title: 'Debate Archive · Lobby Market',
  description:
    'Browse the complete record of every resolved civic debate on Lobby Market — laws passed, topics that failed, and the key arguments on both sides.',
  openGraph: {
    title: 'Debate Archive · Lobby Market',
    description:
      'The civic record: every resolved debate, its outcome, and the strongest FOR and AGAINST arguments that shaped the consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Debate Archive · Lobby Market',
    description:
      'Every resolved civic debate — laws passed and topics that failed — with the arguments that mattered.',
  },
}

export default function TranscriptsPage() {
  return <TranscriptsClient />
}
