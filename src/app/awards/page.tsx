import type { Metadata } from 'next'
import { AwardsClient } from './AwardsClient'

export const metadata: Metadata = {
  title: 'Civic Awards Hall · Lobby Market',
  description:
    'Weekly, monthly, and all-time recognition for the top civic contributors on Lobby Market — best arguments, bridge builders, top voters, and more.',
  openGraph: {
    title: 'Civic Awards Hall · Lobby Market',
    description:
      'Who argued best, bridged the divide, and passed the most laws? The Civic Awards Hall highlights the platform\'s standout contributors.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Awards Hall · Lobby Market',
    description: 'Top civic contributors — best arguments, bridge builders, debate masters, and more.',
  },
}

export default function AwardsPage() {
  return <AwardsClient />
}
