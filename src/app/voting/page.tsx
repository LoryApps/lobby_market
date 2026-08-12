import type { Metadata } from 'next'
import { VotingClient } from './VotingClient'

export const metadata: Metadata = {
  title: 'Votes in Progress · Lobby Market',
  description:
    'Every civic debate currently in the voting phase — sorted by urgency. These are the live decisions your vote can still shape. Cast yours before time runs out.',
  openGraph: {
    title: 'Votes in Progress · Lobby Market',
    description:
      'All active voting-phase debates on Lobby Market. Every vote counts — some of these close in hours.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Votes in Progress · Lobby Market',
    description: 'Live civic votes — closing soon. Every decision your vote can still shape.',
  },
}

export default function VotingPage() {
  return <VotingClient />
}
