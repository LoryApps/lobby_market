import type { Metadata } from 'next'
import { DopplerClient } from './DopplerClient'

export const metadata: Metadata = {
  title: 'Civic Doppler · Lobby Market',
  description:
    'A 2-D scatter map plotting every active civic debate by vote velocity and consensus direction. See which topics are launching, crashing, drifting, or parked — at a glance.',
  openGraph: {
    title: 'Civic Doppler · Lobby Market',
    description:
      'Where is every active debate heading? The Civic Doppler maps topics by how fast votes are coming in (velocity) versus which direction consensus is shifting (direction). Launching, crashing, drifting, or parked — all on one chart.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Doppler · Lobby Market',
    description:
      'Velocity × direction scatter map for every active civic debate. See what\'s launching, crashing, or parked right now.',
  },
}

export default function DopplerPage() {
  return <DopplerClient />
}
