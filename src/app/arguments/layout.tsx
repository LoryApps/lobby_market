import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Top Arguments · Lobby Market',
  description:
    'The most upvoted FOR and AGAINST arguments ever made in the Lobby — the sharpest minds, the best cases, ranked by community approval.',
  openGraph: {
    title: 'Top Arguments · Lobby Market',
    description: 'The best FOR and AGAINST arguments the Lobby has ever seen.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Top Arguments · Lobby Market',
    description: 'The most upvoted arguments in the Lobby.',
  },
}

export default function ArgumentsLayout({ children }: { children: ReactNode }) {
  return children
}
