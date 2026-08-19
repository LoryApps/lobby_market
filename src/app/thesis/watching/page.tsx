import type { Metadata } from 'next'
import { WatchingThesesClient } from './WatchingThesesClient'

export const metadata: Metadata = {
  title: 'Thesis Watchlist · Lobby Market',
  description:
    'Track specific civic predictions you are watching — see agreement splits, resolution dates, and outcomes for theses you have bookmarked.',
  openGraph: {
    title: 'Thesis Watchlist · Lobby Market',
    description: 'The civic predictions you are tracking — resolution dates, community agreement, and outcomes.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function WatchingThesesPage() {
  return <WatchingThesesClient />
}
