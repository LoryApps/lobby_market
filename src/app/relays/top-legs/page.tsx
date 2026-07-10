import type { Metadata } from 'next'
import { TopLegsClient } from './TopLegsClient'

export const metadata: Metadata = {
  title: 'Top Relay Legs · Lobby Market',
  description:
    'The highest-starred individual contributions across all civic relay chains. Discover the single best arguments in collaborative relay reasoning — ranked by community stars.',
  openGraph: {
    title: 'Top Relay Legs · Lobby Market',
    description:
      'Not all relay legs are created equal. These are the community\'s favourite individual contributions — the building blocks of the best civic arguments.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Top Relay Legs · Lobby Market',
    description:
      'The most-starred individual relay legs on Lobby Market — the best building blocks of civic argument chains.',
  },
}

export default function TopLegsPage() {
  return <TopLegsClient />
}
