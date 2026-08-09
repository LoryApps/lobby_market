import type { Metadata } from 'next'
import { OverdriveClient } from './OverdriveClient'

export const metadata: Metadata = {
  title: 'Civic Overdrive · Lobby Market',
  description:
    'The debates where citizens argue far more than they vote. Ranked by argument-to-voter ratio — the platform\'s intellectual black holes where words outweigh ballots.',
  openGraph: {
    title: 'Civic Overdrive · Lobby Market',
    description:
      'Debates where the intellectual contest has gone into overdrive — arguments piling up faster than votes. Find the topics where the community goes deepest.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Overdrive · Lobby Market',
    description:
      'Topics ranked by argument density per voter — the civic debates where the intellectual fight dwarfs the vote count.',
  },
}

export default function OverdrivePage() {
  return <OverdriveClient />
}
