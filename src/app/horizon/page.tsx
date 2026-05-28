import type { Metadata } from 'next'
import { HorizonClient } from './HorizonClient'

export const metadata: Metadata = {
  title: 'The Civic Horizon · Lobby Market',
  description:
    'What\'s about to happen in the Lobby — topics nearing law status, debates approaching majority, early-momentum proposals, and upcoming debates on the calendar.',
  openGraph: {
    title: 'The Civic Horizon · Lobby Market',
    description:
      'The next 48 hours of civic democracy — laws about to pass, debates about to ignite, and the topics gaining unstoppable momentum.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'The Civic Horizon · Lobby Market',
    description: 'What\'s about to happen: laws near passing, debates nearing ignition, new topics gaining fast.',
  },
}

export default function HorizonPage() {
  return <HorizonClient />
}
