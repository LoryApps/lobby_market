import type { Metadata } from 'next'
import { BracketClient } from './BracketClient'

export const metadata: Metadata = {
  title: 'Relay Bracket · Lobby Market',
  description:
    'The weekly Relay Chain Tournament — the top 8 completed relay chains face off in a single-elimination bracket. Seeded by compelling votes and leg quality. Who will be this week\'s champion?',
  openGraph: {
    title: 'Relay Bracket · Lobby Market',
    description:
      '8 relay chains enter. 1 emerges champion. The weekly single-elimination tournament for the most compelling civic argument chains on Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Relay Bracket · Lobby Market',
    description:
      'The weekly Relay Chain Tournament — vote on which civic relay chain makes the strongest case.',
  },
}

export default function RelayBracketPage() {
  return <BracketClient />
}
