import type { Metadata } from 'next'
import { StatusClient } from './StatusClient'

export const metadata: Metadata = {
  title: 'Platform Status · Lobby Market',
  description:
    'Live status and health metrics for Lobby Market — database, API, auth, and real-time platform activity.',
  openGraph: {
    title: 'Platform Status · Lobby Market',
    description: 'Live health dashboard for the Lobby Market platform.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Platform Status · Lobby Market',
    description: 'Live health metrics — database, API, auth, and platform activity.',
  },
}

export default function StatusPage() {
  return <StatusClient />
}
