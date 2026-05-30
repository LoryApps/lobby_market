import type { Metadata } from 'next'
import { BallotClient } from './BallotClient'

export const metadata: Metadata = {
  title: 'Your Civic Ballot · Lobby Market',
  description:
    'Cast your votes on the issues that matter. Your personal civic ballot — active topics waiting for your voice, presented one at a time.',
  openGraph: {
    title: 'Your Civic Ballot · Lobby Market',
    description:
      'Vote on every active topic in one focused session. Your voice, your ballot, your impact.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Your Civic Ballot · Lobby Market',
    description: 'All the active civic debates waiting for your vote. One at a time. Go.',
  },
}

export default function BallotPage() {
  return <BallotClient />
}
