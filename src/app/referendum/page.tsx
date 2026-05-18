import type { Metadata } from 'next'
import { ReferendumClient } from './ReferendumClient'

export const metadata: Metadata = {
  title: 'Civic Referendums · Lobby Market',
  description:
    'Citizens propose and vote on platform governance, new features, and community policies. Shape Lobby Market through democratic referendums.',
  openGraph: {
    title: 'Civic Referendums · Lobby Market',
    description:
      'Platform governance by the people. Propose changes, vote on referendums, and shape Lobby Market through direct democracy.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Referendums · Lobby Market',
    description: 'Propose and vote on platform changes — direct democracy for Lobby Market.',
  },
}

export default function ReferendumPage() {
  return <ReferendumClient />
}
