import type { Metadata } from 'next'
import { SnapshotClient } from './SnapshotClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Snapshot · Lobby Market',
  description:
    'The real-time state of civic debate — live vote tallies, laws just passed, topics in final voting, and the most powerful arguments of the moment.',
  openGraph: {
    title: 'Civic Snapshot · Lobby Market',
    description:
      'A live, shareable snapshot of democratic discourse — see where the consensus stands right now.',
    type: 'website',
    siteName: 'Lobby Market',
    images: [{ url: '/api/og/snapshot', width: 1200, height: 630, alt: 'Lobby Market Civic Snapshot' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Snapshot · Lobby Market',
    description:
      'Live vote tallies, passing laws, and the strongest arguments — a real-time window into civic democracy.',
    images: ['/api/og/snapshot'],
  },
  alternates: {
    canonical: 'https://lobby.market/snapshot',
    types: {
      'application/rss+xml': 'https://lobby.market/api/rss',
    },
  },
}

export default function SnapshotPage() {
  return <SnapshotClient />
}
