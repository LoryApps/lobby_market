import type { Metadata } from 'next'
import { GroupsClient } from './GroupsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Market Groups · Lobby Exchange',
  description:
    'Create and manage thematic baskets of civic prediction markets — curate your own indices, track aggregate consensus, and share your market thesis.',
  robots: { index: false },
  openGraph: {
    title: 'Market Groups · Lobby Exchange',
    description:
      'Build thematic market baskets — climate, healthcare, tech — and track their aggregate consensus as a single index.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Market Groups · Lobby Exchange',
    description: 'Create custom civic market baskets and track aggregate consensus.',
  },
}

export default function GroupsPage() {
  return <GroupsClient />
}
