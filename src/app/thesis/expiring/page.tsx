import type { Metadata } from 'next'
import { ExpiringThesesClient } from './ExpiringThesesClient'

export const metadata: Metadata = {
  title: 'Expiring Theses · Lobby Market',
  description:
    'Active civic theses resolving in the next 7 days — cast your vote before the deadline.',
  openGraph: {
    title: 'Expiring Theses · Lobby Market',
    description: 'Active civic theses resolving in the next 7 days.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Expiring Theses · Lobby Market',
    description: 'Cast your vote before these civic theses close.',
  },
}

export default function ExpiringThesesPage() {
  return <ExpiringThesesClient />
}
