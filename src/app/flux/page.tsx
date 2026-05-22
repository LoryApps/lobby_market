import type { Metadata } from 'next'
import { FluxClient } from './FluxClient'

export const metadata: Metadata = {
  title: 'Civic Flux · Lobby Market',
  description:
    'Topics where the community is actively changing its mind — the largest consensus shifts in the last 24 hours. Track where the democratic tide is turning.',
  openGraph: {
    title: 'Civic Flux · Lobby Market',
    description:
      'Where is the community changing its mind? Real-time consensus shift tracker — topics whose FOR/AGAINST ratio is moving fastest right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Flux · Lobby Market',
    description:
      'Track which debates are shifting in real time. The biggest consensus swings across all civic topics.',
  },
}

export default function FluxPage() {
  return <FluxClient />
}
