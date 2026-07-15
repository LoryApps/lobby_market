import type { Metadata } from 'next'
import { WatchlistClient } from './WatchlistClient'

export const metadata: Metadata = {
  title: 'My Watchlist · Lobby Exchange',
  description:
    'Your personal market watchlist — track civic prediction markets you care about at a glance.',
  openGraph: {
    title: 'My Watchlist · Lobby Exchange',
    description: 'Track your favourite civic prediction markets in one place.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function WatchlistPage() {
  return <WatchlistClient />
}
