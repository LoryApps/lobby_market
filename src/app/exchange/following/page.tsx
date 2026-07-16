import type { Metadata } from 'next'
import { FollowingClient } from './FollowingClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Following Feed · Lobby Exchange',
  description:
    'Market positions from traders you follow — see what FOR/AGAINST bets your network is placing and where consensus is forming among your followed forecasters.',
  robots: { index: false },
  openGraph: {
    title: 'Following Feed · Lobby Exchange',
    description:
      'Positions from traders you follow. Track where your network is placing bets on civic consensus markets.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Following Feed · Lobby Exchange',
    description: 'Civic market positions from forecasters you follow.',
  },
}

export default function FollowingPage() {
  return <FollowingClient />
}
