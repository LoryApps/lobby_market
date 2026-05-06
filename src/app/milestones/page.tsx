import type { Metadata } from 'next'
import { MilestonesClient } from './MilestonesClient'

export const metadata: Metadata = {
  title: 'Civic Milestones · Lobby Market',
  description:
    'Your personal civic journey — every first vote, first argument, first debate, and key achievements in your Lobby Market history.',
  openGraph: {
    title: 'Civic Milestones · Lobby Market',
    description:
      'Relive the key moments that define your civic journey — first votes, landmark arguments, debate records, and clout milestones.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Milestones · Lobby Market',
    description: 'Every civic first and breakthrough moment in your Lobby Market journey.',
  },
}

export default function MilestonesPage() {
  return <MilestonesClient />
}
