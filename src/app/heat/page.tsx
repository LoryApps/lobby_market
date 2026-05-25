import type { Metadata } from 'next'
import { HeatClient } from './HeatClient'

export const metadata: Metadata = {
  title: 'Civic Heat Index · Lobby Market',
  description:
    'Which debates are burning brightest right now? The Heat Index ranks every active topic by composite engagement intensity — vote velocity, argument bursts, reply surges, and controversy level.',
  openGraph: {
    title: 'Civic Heat Index · Lobby Market',
    description:
      'Live temperature readings for every civic debate. Inferno, Blazing, Heating, Warm, or Cool — find out which debates are on fire.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Heat Index · Lobby Market',
    description:
      'Which debates are on fire? Vote velocity + argument bursts + reply surges = a live heat score for every topic.',
  },
}

export default function HeatPage() {
  return <HeatClient />
}
