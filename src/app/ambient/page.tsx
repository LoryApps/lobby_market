import type { Metadata } from 'next'
import { AmbientClient } from './AmbientClient'

export const metadata: Metadata = {
  title: 'Civic Ambient Display · Lobby Market',
  description:
    'A fullscreen ambient display of live civic activity — vote counts, laws, arguments, and consensus forming in real time. Perfect for offices, conferences, and public screens.',
  openGraph: {
    title: 'Civic Ambient Display · Lobby Market',
    description:
      'Watch democracy unfold. A living screensaver of civic data — votes cast, arguments made, laws passed, and consensus building right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  robots: { index: false },
}

export default function AmbientPage() {
  return <AmbientClient />
}
