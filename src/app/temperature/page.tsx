import type { Metadata } from 'next'
import { TemperatureClient } from './TemperatureClient'

export const metadata: Metadata = {
  title: 'Civic Temperature · Lobby Market',
  description:
    'Which debates are running hot right now? The Civic Temperature ranks every active topic by a composite heat score — combining controversy, recent vote velocity, and engagement depth.',
  openGraph: {
    title: 'Civic Temperature · Lobby Market',
    description:
      'Not just trending — actually hot. Temperature combines how contested a debate is, how fast votes are landing, and how deep the engagement runs. Find the debates on fire right now.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Temperature · Lobby Market',
    description:
      'Which debates are running hot right now? Controversy × velocity × engagement = Temperature.',
  },
}

export default function TemperaturePage() {
  return <TemperatureClient />
}
