import type { Metadata } from 'next'
import { ArguedClient } from './ArguedClient'

export const metadata: Metadata = {
  title: 'Most Argued · Lobby Market',
  description:
    'Topics on fire — ranked by argument activity in the last 24 hours. Where the sharpest minds are debating right now.',
  openGraph: {
    title: 'Most Argued · Lobby Market',
    description:
      'The debates with the most intellectual heat right now. Not just the most voted — the most argued.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Most Argued · Lobby Market',
    description: 'Where the sharpest arguments are being written right now — updated every 24 hours.',
  },
}

export default function ArguedPage() {
  return <ArguedClient />
}
