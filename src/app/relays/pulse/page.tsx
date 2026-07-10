import type { Metadata } from 'next'
import { PulseClient } from './PulseClient'

export const metadata: Metadata = {
  title: 'Relay Pulse · Lobby Market',
  description:
    'Live feed of relay leg contributions across the platform — watch civic arguments build in real time. Filter by side and category.',
  openGraph: {
    title: 'Relay Pulse · Lobby Market',
    description:
      'See every relay argument leg the moment it lands — live collaborative debate-building across the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Relay Pulse · Lobby Market',
    description: 'Live relay contributions — collaborative civic arguments forming in real time.',
  },
}

export default function RelayPulsePage() {
  return <PulseClient />
}
