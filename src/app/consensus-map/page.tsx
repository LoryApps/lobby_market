import type { Metadata } from 'next'
import { ConsensusMapClient } from './ConsensusMapClient'

export const metadata: Metadata = {
  title: 'Consensus Map · Lobby Market',
  description:
    'Where the Lobby agrees and where it splits. Every active civic debate mapped by consensus strength — discover the platform\'s most divided debates and strongest agreements.',
  openGraph: {
    title: 'Consensus Map · Lobby Market',
    description:
      'A live map of civic consensus — which debates have the community unified, which are perfectly split, and which are trending toward becoming law.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Consensus Map · Lobby Market',
    description:
      'Discover where the civic community agrees and where it divides — every active debate mapped by consensus strength.',
  },
}

export default function ConsensusMapPage() {
  return <ConsensusMapClient />
}
