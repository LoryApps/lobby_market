import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Search · Lobby Market',
  description:
    'Search for topics, laws, users, and arguments across the Lobby — full-text search powered by Postgres.',
  openGraph: {
    title: 'Search · Lobby Market',
    description: 'Find topics, laws, users, and arguments across the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Search · Lobby Market',
    description: 'Search across all debates, laws, and users in the Lobby.',
  },
}

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children
}
