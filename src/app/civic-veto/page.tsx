import type { Metadata } from 'next'
import { VetoClient } from './VetoClient'

export const metadata: Metadata = {
  title: 'Civic Veto · Lobby Market',
  description:
    'Challenge established laws through collective democratic action. Gather enough signatures to force formal reconsideration of any consensus law.',
  openGraph: {
    title: 'Civic Veto · Lobby Market',
    description:
      'The democratic override chamber. When enough citizens sign a veto, an established law must be reconsidered — not repealed, but re-examined by the community.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Veto · Lobby Market',
    description: 'Challenge established laws. Gather signatures. Force reconsideration.',
  },
}

export default function CivicVetoPage() {
  return <VetoClient />
}
