import type { Metadata } from 'next'
import { CivicIntegrityClient } from './CivicIntegrityClient'

export const metadata: Metadata = {
  title: 'Civic Integrity Monitor · Lobby Market',
  description:
    'Platform health dashboard — vote-pattern signals, coordinated activity detection, and daily integrity snapshots. Transparency into how Lobby Market maintains fair democratic participation.',
  openGraph: {
    title: 'Civic Integrity Monitor · Lobby Market',
    description:
      'Real-time platform integrity signals and 30-day health trends. Vote clusters, coordinated swings, and sock puppet detection — all visible to the community.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Integrity Monitor · Lobby Market',
    description: 'Platform health in real time — flagged signals, daily health score, transparency.',
  },
}

export default function CivicIntegrityMonitorPage() {
  return <CivicIntegrityClient />
}
