import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Discover · Lobby Market',
  description:
    'Explore suggested voices to follow, hot topics, upcoming debates, new laws, and every category in the Lobby.',
  openGraph: {
    title: 'Discover · Lobby Market',
    description:
      'Find people to follow, browse categories, and explore what\'s happening in the Lobby right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Discover · Lobby Market',
    description: 'Explore suggested voices, hot topics, and new laws in the Lobby.',
  },
}

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children
}
