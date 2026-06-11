import type { Metadata } from 'next'
import { TerminalClient } from './TerminalClient'

export const metadata: Metadata = {
  title: 'Consensus Terminal · Lobby Market',
  description:
    'A Bloomberg-style live market terminal for civic debates. Every active topic ranked by consensus, momentum, vote velocity, and spread. The Lobby as a real-time market.',
  openGraph: {
    title: 'Consensus Terminal · Lobby Market',
    description:
      'Live market data for every active civic debate — consensus %, vote velocity, momentum signals, and contention levels. The Lobby as a live market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Consensus Terminal · Lobby Market',
    description: 'Real-time market view of all active civic debates. Sort by consensus, velocity, or momentum.',
  },
}

export default function TerminalPage() {
  return <TerminalClient />
}
