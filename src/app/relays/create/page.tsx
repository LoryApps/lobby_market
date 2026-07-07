import type { Metadata } from 'next'
import { CreateRelayClient } from './CreateRelayClient'

export const metadata: Metadata = {
  title: 'Start a Civic Relay · Lobby Market',
  description:
    'Begin a collaborative argument chain — pick a topic, choose your side, write the opening leg, and invite others to continue building the case.',
  openGraph: {
    title: 'Start a Civic Relay · Lobby Market',
    description:
      'Civic relays are collaborative argument chains. Start the first leg and let others continue. Up to 5 contributors can build the most persuasive case together.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Start a Civic Relay · Lobby Market',
    description:
      'Start a collaborative argument chain. Pick your side, write the first leg, and see where it goes.',
  },
}

export default function CreateRelayPage() {
  return <CreateRelayClient />
}
