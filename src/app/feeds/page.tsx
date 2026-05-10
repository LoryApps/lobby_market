import type { Metadata } from 'next'
import { FeedsClient } from './FeedsClient'

export const metadata: Metadata = {
  title: 'Feeds · Lobby Market',
  description:
    'Subscribe to Lobby Market via RSS — every law established, active debate, and category feed in one place.',
  openGraph: {
    title: 'Feeds · Lobby Market',
    description:
      'RSS feeds for every corner of the Lobby: laws, debates, and all 10 civic categories.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Feeds · Lobby Market',
    description: 'Subscribe to Lobby Market debates and laws via RSS.',
  },
}

export default function FeedsPage() {
  return <FeedsClient />
}
