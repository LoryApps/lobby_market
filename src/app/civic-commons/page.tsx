import type { Metadata } from 'next'
import { CivicCommonsClient } from './CivicCommonsClient'

export const metadata: Metadata = {
  title: 'The Civic Commons · Lobby Market',
  description:
    'Central governance hub for Lobby Market — all active Grand Council motions, Citizens\' Assemblies, civic referendums, tribunal cases, and elections in one place.',
  openGraph: {
    title: 'The Civic Commons · Lobby Market',
    description:
      'The front page of the civic parliament. See every active governance process — from Grand Council motions to Citizens\' Assemblies, referendums, and elections — in one live dashboard.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Commons · Lobby Market',
    description:
      'Live governance dashboard: council motions, assemblies, referendums, tribunal cases, and elections — all in one place.',
  },
}

export default function CivicCommonsPage() {
  return <CivicCommonsClient />
}
