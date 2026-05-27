import type { Metadata } from 'next'
import { StandoffClient } from './StandoffClient'

export const metadata: Metadata = {
  title: 'The Civic Standoff · Lobby Market',
  description:
    'Debates locked in persistent deadlock — topics where neither side can tip the balance despite active recent voting. The community is divided. Your vote could break it.',
  openGraph: {
    title: 'The Civic Standoff · Lobby Market',
    description:
      'True civic gridlock: debates locked near 50/50 with active voting on both sides. Neither side can tip the balance — until you vote.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Standoff · Lobby Market',
    description: 'Debates stuck at 50/50 with nobody winning. Your vote could break the deadlock.',
  },
}

export default function StandoffPage() {
  return <StandoffClient />
}
