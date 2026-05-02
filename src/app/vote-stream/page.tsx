import type { Metadata } from 'next'
import { VoteStreamClient } from './VoteStreamClient'

export const metadata: Metadata = {
  title: 'Vote Stream · Lobby Market',
  description:
    'Watch democracy happen in real-time. Every vote cast across the Lobby — live, anonymous, and unstoppable. See what the community is deciding right now.',
  openGraph: {
    title: 'Vote Stream · Lobby Market',
    description:
      'A real-time ticker of every vote landing on the platform. The pulse of civic consensus, second by second.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Vote Stream · Lobby Market',
    description: 'Live civic voting — see what the Lobby is deciding right now.',
  },
}

export default function VoteStreamPage() {
  return <VoteStreamClient />
}
