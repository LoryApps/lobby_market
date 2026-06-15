import type { Metadata } from 'next'
import { FeedsClient } from './FeedsClient'

export const metadata: Metadata = {
  title: 'Feeds · Lobby Market',
  description:
    'Subscribe to Lobby Market via RSS — every law established, active debate, top argument, category feed, and topic tag feed in one place.',
  openGraph: {
    title: 'Feeds · Lobby Market',
    description:
      'RSS feeds for every corner of the Lobby: laws, debates, top arguments, all 10 civic categories, and keyword tag feeds like #climate, #ai, and #democracy.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Feeds · Lobby Market',
    description: 'Subscribe to Lobby Market debates, laws, and top arguments via RSS.',
  },
}

export default function FeedsPage() {
  return <FeedsClient />
}
