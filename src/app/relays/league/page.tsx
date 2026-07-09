import type { Metadata } from 'next'
import { RelayLeagueClient } from './RelayLeagueClient'

export const metadata: Metadata = {
  title: 'Relay League · Lobby Market',
  description:
    'The weekly competition for the most compelling civic relay chains. See which argument chains earned the most community votes and which builders are rising to the top.',
  openGraph: {
    title: 'Relay League · Lobby Market',
    description:
      'Weekly rankings for the most compelling relay argument chains on Lobby Market — voted by the community.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay League · Lobby Market',
    description: 'Which relay chains are this week\'s best? Community-voted weekly rankings.',
  },
}

export default function RelayLeaguePage() {
  return <RelayLeagueClient />
}
