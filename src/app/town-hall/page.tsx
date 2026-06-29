import type { Metadata } from 'next'
import { TownHallClient } from './TownHallClient'

export const metadata: Metadata = {
  title: 'Civic Town Hall · Lobby Market',
  description:
    'The weekly open session of the Lobby — see what the community is debating, which governance motions are live, and how the platform is performing this week.',
  openGraph: {
    title: 'Civic Town Hall · Lobby Market',
    description:
      'Your weekly civic check-in: active referendums, Grand Council motions, hot debates, new laws, and platform stats — all in one open session.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Town Hall · Lobby Market',
    description: 'Weekly civic session — governance, debates, laws, and platform pulse.',
  },
}

export default function TownHallPage() {
  return <TownHallClient />
}
