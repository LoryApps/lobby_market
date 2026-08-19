import type { Metadata } from 'next'
import { FreshClient } from './FreshClient'

export const metadata: Metadata = {
  title: 'Fresh Debates · Lobby Market',
  description:
    'Civic topics in their first two weeks — sorted by early engagement velocity. Shape the consensus before it hardens.',
  openGraph: {
    title: 'Fresh Debates · Lobby Market',
    description:
      'The newest civic debates gaining early traction. Vote now, while the outcome is still undecided and every voice carries extra weight.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Fresh Debates · Lobby Market',
    description: 'New civic debates with early momentum — your vote matters most when consensus is still forming.',
  },
}

export default function FreshPage() {
  return <FreshClient />
}
