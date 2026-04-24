import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Community Pulse · Lobby Market',
  description:
    'The live heartbeat of the Lobby — top FOR and AGAINST arguments streaming in from active debates in real-time.',
  openGraph: {
    title: 'Community Pulse · Lobby Market',
    description: 'Live stream of the best arguments from active debates across the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Community Pulse · Lobby Market',
    description: 'Real-time stream of top arguments from the Lobby.',
  },
}

export default function PulseLayout({ children }: { children: ReactNode }) {
  return children
}
