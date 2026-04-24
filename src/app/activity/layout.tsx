import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Activity · Lobby Market',
  description:
    'What\'s happening in the Lobby right now — recent votes, new topics, debates starting, and laws being established.',
  openGraph: {
    title: 'Activity · Lobby Market',
    description: 'The live activity stream of the Lobby — votes, topics, debates, and laws.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Activity · Lobby Market',
    description: 'Live activity stream of the Lobby.',
  },
}

export default function ActivityLayout({ children }: { children: ReactNode }) {
  return children
}
