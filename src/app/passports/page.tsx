import type { Metadata } from 'next'
import { PassportsClient } from './PassportsClient'

export const metadata: Metadata = {
  title: 'Civic Passports · Lobby Market',
  description:
    'Browse civic passports for all registered citizens. Each passport summarises a citizen\'s voting record, archetype, clout, and civic contributions.',
  openGraph: {
    title: 'Civic Passports · Lobby Market',
    description: 'Discover civic identities across the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default function PassportsPage() {
  return <PassportsClient />
}
