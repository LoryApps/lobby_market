import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Vote Twins · Lobby Market',
  description:
    'Discover citizens who voted most like you — find your political allies and your ideological rivals based on real vote history.',
  openGraph: {
    title: 'Vote Twins · Lobby Market',
    description:
      'Who votes like you? Find your political matches based on shared vote history.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Vote Twins · Lobby Market',
    description: 'Find citizens who voted most like you on Lobby Market.',
  },
}

export default function TwinsLayout({ children }: { children: ReactNode }) {
  return children
}
