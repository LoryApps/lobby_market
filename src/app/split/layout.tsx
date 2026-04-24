import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'The Split · Lobby Market',
  description:
    'The most evenly contested topics in the Lobby — where neither side has a clear majority and every vote could tip the balance.',
  openGraph: {
    title: 'The Split · Lobby Market',
    description: 'Topics splitting the Lobby 50/50 — your vote could break the deadlock.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Split · Lobby Market',
    description: 'Deadlocked debates where every vote counts.',
  },
}

export default function SplitLayout({ children }: { children: ReactNode }) {
  return children
}
