import type { Metadata } from 'next'
import { RelayChampionsClient } from './RelayChampionsClient'

export const metadata: Metadata = {
  title: 'Relay Champions · Lobby Market',
  description:
    'Top relay chain builders and contributors — ranked by compelling relay count, leg contributions, and community star ratings.',
  openGraph: {
    title: 'Relay Champions · Lobby Market',
    description:
      'The citizens who build and sustain the most compelling civic relay argument chains. Ranked by compelling relays started, legs contributed, and star ratings.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay Champions · Lobby Market',
    description: 'Top relay builders ranked by compelling chains, leg contributions, and community stars.',
  },
}

export default function RelayChampionsPage() {
  return <RelayChampionsClient />
}
