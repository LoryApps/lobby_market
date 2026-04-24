import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Global Stats · Lobby Market',
  description:
    'Live platform statistics — total votes cast, laws established, active debates, and community growth across the Lobby.',
  openGraph: {
    title: 'Global Stats · Lobby Market',
    description: 'The Lobby by the numbers: votes, laws, debates, and community growth.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Global Stats · Lobby Market',
    description: 'The Lobby by the numbers.',
  },
}

export default function StatsLayout({ children }: { children: ReactNode }) {
  return children
}
